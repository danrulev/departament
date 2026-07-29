// internal/handler/photo.go

package handler

import (
	"context"
	"fmt"
	"io"
	"mitm-departament/internal/config"
	"mitm-departament/internal/models"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var allowedTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

type PhotoHandler struct {
	repo PhotoService
	cfg  config.PhotoConfig
}

type PhotoService interface {
	Create(ctx context.Context, p *models.EquipmentPhoto) error
	ListByEquipment(ctx context.Context, equipmentID int64) ([]models.EquipmentPhoto, error)
	GetByID(ctx context.Context, id int64) (*models.EquipmentPhoto, error)
	Delete(ctx context.Context, id int64) error
	CountByEquipment(ctx context.Context, equipmentID int64) (int, error)
}

func NewPhotoHandler(repo PhotoService, cfg config.PhotoConfig) *PhotoHandler {
	// Создаём папку для фото при старте
	_ = os.MkdirAll(cfg.PhotoDir, 0755)
	return &PhotoHandler{repo: repo, cfg: cfg}
}

func (h *PhotoHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// Загрузка и список — привязаны к оборудованию
	rg.POST("/equipment/:id/photos", h.upload, requireRoles(adminKey))
	rg.GET("/equipment/:id/photos", h.list)

	// Отдача и удаление — по ID фото
	rg.GET("/photos/:photo_id", h.serve)
	rg.DELETE("/photos/:photo_id", h.delete, requireRoles(adminKey))
}

// POST /equipment/:id/photos  (multipart/form-data, поле "photo")
func (h *PhotoHandler) upload(c *gin.Context) {
	equipID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	// Лимит фото
	count, err := h.repo.CountByEquipment(c.Request.Context(), equipID)
	if err != nil {
		handleError(c, err)
		return
	}
	if count >= h.cfg.MaxPhotos {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: fmt.Sprintf("максимум %d фото", h.cfg.MaxPhotos)})
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

	// Сохраняем на диск
	storedName := uuid.New().String() + ext
	dst := filepath.Join(h.cfg.PhotoDir, storedName)

	out, err := os.Create(dst)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "ошибка сохранения файла"})
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		os.Remove(dst)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "ошибка записи файла"})
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
		StoredName:  storedName,
		ContentType: contentType,
		SizeBytes:   header.Size,
		UploadedBy:  uploadedBy,
	}

	if err := h.repo.Create(c.Request.Context(), photo); err != nil {
		os.Remove(dst) // откатываем файл
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

	photos, err := h.repo.ListByEquipment(c.Request.Context(), equipID)
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

	photo, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil || photo == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "фото не найдено"})
		return
	}

	filePath := filepath.Join(h.cfg.PhotoDir, photo.StoredName)
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

	photo, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil || photo == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "фото не найдено"})
		return
	}

	// Удаляем файл
	filePath := filepath.Join(h.cfg.PhotoDir, photo.StoredName)
	_ = os.Remove(filePath)

	// Удаляем из БД
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, MessageResponse{Message: "фото удалено"})
}
