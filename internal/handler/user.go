package handler

import (
	"io"
	"mitm-departament/internal/config"
	"mitm-departament/internal/models"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userSvc UserService
	keySvc  KeyService
	cfg     config.PhotoConfig
}

func NewUserHandler(userSvc UserService, keySvc KeyService, cfg config.PhotoConfig) *UserHandler {
	_ = os.MkdirAll(cfg.AvatarPhotoDir, 0755)
	return &UserHandler{
		userSvc: userSvc,
		keySvc:  keySvc,
		cfg:     cfg,
	}
}

func (h *UserHandler) RegisterRoutes(rg *gin.RouterGroup) {
	users := rg.Group("/users")
	{
		users.POST("", h.Create, requireRoles(adminKey))
		users.GET("", h.ListActive)
		users.GET("/:id", h.GetByID)
		users.PUT("/:id", h.Update, requireRoles(adminKey))
		users.DELETE("/:id", h.Deactivate, requireRoles(adminKey))
		users.GET("/:id/history", h.History)
		users.GET("/avatars/:id", h.GetAvatar)
		users.POST("/:id/avatar", h.UploadAvatar, requireRoles(adminKey))   // ← новое
		users.DELETE("/:id/avatar", h.DeleteAvatar, requireRoles(adminKey)) // ← новое
	}
}

func (h *UserHandler) Create(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleValidationError(c, err)
		return
	}

	user := &models.User{
		Avatar:   req.Avatar,
		FullName: req.FullName,
		Password: req.Password,
		Role:     req.Role,
		Position: req.Position,
		Phone:    req.Phone,
		Email:    req.Email,
		IsActive: true,
	}

	if err := h.userSvc.Create(c.Request.Context(), user); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, ToUserResponse(user))
}

func (h *UserHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	user, err := h.userSvc.GetByID(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, ToUserResponse(user))
}

func (h *UserHandler) ListActive(c *gin.Context) {
	users, err := h.userSvc.ListActive(c.Request.Context())
	if err != nil {
		handleError(c, err)
		return
	}

	resp := make([]UserResponse, 0, len(users))
	for i := range users {
		resp = append(resp, ToUserResponse(&users[i]))
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UserHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleValidationError(c, err)
		return
	}

	user, err := h.userSvc.GetByID(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}

	user.FullName = req.FullName
	user.Role = req.Role
	user.Phone = req.Phone
	user.Email = req.Email
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}
	user.Position = req.Position
	user.Avatar = req.Avatar

	if err := h.userSvc.Update(c.Request.Context(), user); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, ToUserResponse(user))
}

func (h *UserHandler) Deactivate(c *gin.Context) {
	id := c.Param("id")

	if err := h.userSvc.Deactivate(c.Request.Context(), id); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, MessageResponse{Message: "пользователь деактивирован"})
}

func (h *UserHandler) History(c *gin.Context) {
	id := c.Param("id")

	if _, err := h.userSvc.GetByID(c.Request.Context(), id); err != nil {
		handleError(c, err)
		return
	}

	logs, err := h.keySvc.HistoryForUser(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}

	resp := make([]KeyLogResponse, 0, len(logs))
	for i := range logs {
		resp = append(resp, ToKeyLogResponse(&logs[i]))
	}

	c.JSON(http.StatusOK, resp)
}

func (h *UserHandler) UploadAvatar(c *gin.Context) {
	id := c.Param("id")

	user, err := h.userSvc.GetByID(c.Request.Context(), id)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "пользователь не найден"})
		return
	}

	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "поле 'avatar' обязательно"})
		return
	}
	defer file.Close()

	if header.Size > int64(h.cfg.MaxPhotoSize) {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "файл слишком большой (макс. 5 МБ)"})
		return
	}

	contentType := header.Header.Get("Content-Type")
	ext, ok := allowedTypes[contentType] // из photo.go
	if !ok {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "допустимы: JPEG, PNG, WebP, GIF"})
		return
	}

	// Удаляем старый файл
	if user.Avatar != nil && *user.Avatar != "" {
		_ = os.Remove(filepath.Join(h.cfg.AvatarPhotoDir, *user.Avatar))
	}

	storedName := "avatar_" + id + ext
	dst := filepath.Join(h.cfg.AvatarPhotoDir, storedName)

	out, err := os.Create(dst)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "ошибка сохранения"})
		return
	}
	defer out.Close()
	if _, err := io.Copy(out, file); err != nil {
		os.Remove(dst)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "ошибка записи"})
		return
	}

	if err := h.userSvc.SetAvatar(c.Request.Context(), id, storedName); err != nil {
		os.Remove(dst)
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"avatar": "/api/v1/avatars/" + id})
}

func (h *UserHandler) GetAvatar(c *gin.Context) {
	id := c.Param("id")

	user, err := h.userSvc.GetByID(c.Request.Context(), id)
	if err != nil || user == nil || user.Avatar == nil || *user.Avatar == "" {
		c.Status(http.StatusNotFound)
		return
	}

	filePath := filepath.Join(h.cfg.AvatarPhotoDir, *user.Avatar)

	// Проверяем, существует ли файл физически
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.Status(http.StatusNotFound)
		return
	}

	// Определяем Content-Type по расширению файла
	ext := filepath.Ext(filePath)
	contentType := "image/jpeg" // по умолчанию
	switch ext {
	case ".png":
		contentType = "image/png"
	case ".webp":
		contentType = "image/webp"
	case ".gif":
		contentType = "image/gif"
	}

	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=31536000") // Кэширование аватарок
	c.File(filePath)
}

func (h *UserHandler) DeleteAvatar(c *gin.Context) {
	id := c.Param("id")

	user, err := h.userSvc.GetByID(c.Request.Context(), id)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "пользователь не найден"})
		return
	}

	if user.Avatar != nil && *user.Avatar != "" {
		_ = os.Remove(filepath.Join(h.cfg.AvatarPhotoDir, *user.Avatar))
	}
	if err := h.userSvc.SetAvatar(c.Request.Context(), id, ""); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, MessageResponse{Message: "аватар удалён"})
}
