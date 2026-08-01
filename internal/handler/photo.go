// internal/handler/photo.go

package handler

import (
	"context"
	"mime/multipart"
	"mitm-departament/internal/config"
	"mitm-departament/internal/models"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

var allowedTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

type PhotoHandler struct {
	svc PhotoService
	cfg config.PhotoConfig
}

type PhotoService interface {
	Create(ctx context.Context, file multipart.File, ext string, photo *models.EquipmentPhoto) error
	ListByEquipment(ctx context.Context, equipmentID int64) ([]models.EquipmentPhoto, error)
	GetByID(ctx context.Context, id int64) (*models.EquipmentPhoto, error)
	Delete(ctx context.Context, id int64) error
	CountByEquipment(ctx context.Context, equipmentID int64) (int, error)
}

func NewPhotoHandler(svc PhotoService, cfg config.PhotoConfig) *PhotoHandler {
	// Создаём папку для фото при старте
	_ = os.MkdirAll(cfg.EquipmentPhotoDir, 0755)
	return &PhotoHandler{svc: svc, cfg: cfg}
}

func (h *PhotoHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/equipment/:id/photos", h.upload, requireRoles(adminKey))
	rg.GET("/equipment/:id/photos", h.list)
	rg.DELETE("/photos/:photo_id", h.delete, requireRoles(adminKey))
}

// Публичный маршрут — отдача файла (для <img src>)
func (h *PhotoHandler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.GET("/photos/:photo_id", h.serve)
}

// POST /equipment/:id/photos  (multipart/form-data, поле "photo")
func (h *PhotoHandler) upload(c *gin.Context) {
	equipID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "поле 'photo' обязательно"})
		return
	}
	defer file.Close()

	// Размер
	if header.Size > int64(h.cfg.MaxPhotoSize) {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "файл слишком большой (макс. 10 МБ)"})
		return
	}

	// Тип
	contentType := header.Header.Get("Content-Type")
	ext, ok := allowedTypes[contentType]
	if !ok {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "допустимы: JPEG, PNG, WebP, GIF"})
		return
	}

	// Метаданные в БД
	userID, _ := getUserID(c)
	var uploadedBy *string
	if s := userID.String(); s != "" {
		uploadedBy = &s
	}

	photo := &models.EquipmentPhoto{
		EquipmentID: equipID,
		Filename:    header.Filename,
		ContentType: contentType,
		SizeBytes:   header.Size,
		UploadedBy:  uploadedBy,
	}

	if err := h.svc.Create(c.Request.Context(), file, ext, photo); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, photo)
}

// GET /equipment/:id/photos
func (h *PhotoHandler) list(c *gin.Context) {
	equipID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	photos, err := h.svc.ListByEquipment(c.Request.Context(), equipID)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, photos)
}

// GET /photos/:photo_id — отдаёт сам файл
func (h *PhotoHandler) serve(c *gin.Context) {
	id, ok := parseIDParam(c, "photo_id")
	if !ok {
		return
	}

	photo, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil || photo == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "фото не найдено"})
		return
	}

	filePath := filepath.Join(h.cfg.EquipmentPhotoDir, photo.StoredName)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "файл отсутствует на диске"})
		return
	}

	c.Header("Cache-Control", "public, max-age=86400")
	c.File(filePath)
}

// DELETE /photos/:photo_id
func (h *PhotoHandler) delete(c *gin.Context) {
	id, ok := parseIDParam(c, "photo_id")
	if !ok {
		return
	}

	h.svc.Delete(c.Request.Context(), id)

	c.JSON(http.StatusOK, MessageResponse{Message: "фото удалено"})
}
