package handler

import (
	"net/http"

	"mitm-departament/internal/models"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userSvc UserService
	keySvc  KeyService
}

func NewUserHandler(userSvc UserService, keySvc KeyService) *UserHandler {
	return &UserHandler{
		userSvc: userSvc,
		keySvc:  keySvc,
	}
}

func (h *UserHandler) RegisterRoutes(rg *gin.RouterGroup) {
	users := rg.Group("/users")
	{
		users.POST("", h.Create)
		users.GET("", h.ListActive)
		users.GET("/:id", h.GetByID)
		users.PUT("/:id", h.Update)
		users.DELETE("/:id", h.Deactivate)
		users.GET("/:id/history", h.History)
	}
}

func (h *UserHandler) Create(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleValidationError(c, err)
		return
	}

	user := &models.User{
		FullName: req.FullName,
		Password: req.Password,
		Role:     req.Role,
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
