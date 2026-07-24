package handler

import (
	"context"
	"net/http"
	"time"

	"mitm-departament/internal/models"

	"github.com/gin-gonic/gin"
)

// EquipmentService — интерфейс сервиса оборудования
type EquipmentService interface {
	Create(ctx context.Context, e *models.Equipment) error
	GetByID(ctx context.Context, id int64) (*models.Equipment, error)
	List(ctx context.Context, f models.EquipmentFilter) (models.ListEquipment, error)
	ListExpiredVerification(ctx context.Context, limit, offset int64) (models.ListEquipment, error)
	Update(ctx context.Context, e *models.Equipment) error
	Delete(ctx context.Context, id int64) error
}

type EquipmentHandler struct {
	svc EquipmentService
}

func NewEquipmentHandler(svc EquipmentService) *EquipmentHandler {
	return &EquipmentHandler{svc: svc}
}

func (h *EquipmentHandler) RegisterRoutes(rg *gin.RouterGroup) {
	equipment := rg.Group("/equipment")
	{
		equipment.POST("", h.create)
		equipment.GET("", h.list)
		equipment.GET("/expired-verification", h.listExpiredVerification)
		equipment.GET("/:id", h.getByID)
		equipment.PUT("/:id", h.update)
		equipment.DELETE("/:id", h.delete)
	}
}

// parseDate парсит дату формата "2006-01-02"
func parseDate(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (h *EquipmentHandler) create(c *gin.Context) {
	var req CreateEquipmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleValidationError(c, err)
		return
	}

	verificationDate, err := parseDate(req.VerificationDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "неверный формат даты поверки (ожидается YYYY-MM-DD)"})
		return
	}

	status := true
	if req.Status != nil {
		status = *req.Status
	}

	equipment := &models.Equipment{
		Name:             req.Name,
		Description:      req.Description,
		Location:         req.Location,
		Documentation:    req.Documentation,
		InventoryNumber:  req.InventoryNumber,
		ResponsibleID:    req.ResponsibleID,
		Status:           status,
		VerificationDate: verificationDate,
	}

	if err := h.svc.Create(c.Request.Context(), equipment); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, ToEquipmentResponse(equipment))
}

func (h *EquipmentHandler) getByID(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	equipment, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, ToEquipmentResponse(equipment))
}

func (h *EquipmentHandler) list(c *gin.Context) {
	// Биндим query-параметры: limit, offset, search, inventory
	var filter models.EquipmentFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		handleValidationError(c, err)
		return
	}

	filter.Paginated.Validate()

	// status парсим отдельно (строка → bool)
	switch c.Query("status") {
	case "available":
		v := true
		filter.Status = &v
	case "unavailable":
		v := false
		filter.Status = &v
	}

	data, err := h.svc.List(c.Request.Context(), filter)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, data)
}

func (h *EquipmentHandler) listExpiredVerification(c *gin.Context) {
	var p models.Paginated
	if err := c.ShouldBindQuery(&p); err != nil {
		handleValidationError(c, err)
		return
	}

	p.Validate()

	items, err := h.svc.ListExpiredVerification(c.Request.Context(), p.Limit, p.Offset)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, items)
}

func (h *EquipmentHandler) update(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	var req UpdateEquipmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleValidationError(c, err)
		return
	}

	equipment, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		handleError(c, err)
		return
	}

	verificationDate, err := parseDate(req.VerificationDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "неверный формат даты поверки (ожидается YYYY-MM-DD)"})
		return
	}

	equipment.Name = req.Name
	equipment.Description = req.Description
	equipment.Location = req.Location
	equipment.Documentation = req.Documentation
	equipment.InventoryNumber = req.InventoryNumber
	equipment.ResponsibleID = req.ResponsibleID
	equipment.VerificationDate = verificationDate
	if req.Status != nil {
		equipment.Status = *req.Status
	}

	if err := h.svc.Update(c.Request.Context(), equipment); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, ToEquipmentResponse(equipment))
}

func (h *EquipmentHandler) delete(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, MessageResponse{Message: "оборудование удалено"})
}
