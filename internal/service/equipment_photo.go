package service

import (
	"context"
	"mitm-departament/internal/models"

	"go.uber.org/zap"
)

type PhotoRepo interface {
	Create(ctx context.Context, p *models.EquipmentPhoto) error
	ListByEquipment(ctx context.Context, equipmentID int64) ([]models.EquipmentPhoto, error)
	GetByID(ctx context.Context, id int64) (*models.EquipmentPhoto, error)
	Delete(ctx context.Context, id int64) error
	CountByEquipment(ctx context.Context, equipmentID int64) (int, error)
}

type PhotoService struct {
	repo PhotoRepo
	log  *zap.Logger
}

func NewPhotoService(repo PhotoRepo, log *zap.Logger) *PhotoService {
	return &PhotoService{repo: repo, log: log}
}

func (p *PhotoService) Create(ctx context.Context, photo *models.EquipmentPhoto) error {
	return p.repo.Create(ctx, photo)
}

func (p *PhotoService) ListByEquipment(ctx context.Context, equipmentID int64) ([]models.EquipmentPhoto, error) {
	return p.repo.ListByEquipment(ctx, equipmentID)
}

func (p *PhotoService) GetByID(ctx context.Context, id int64) (*models.EquipmentPhoto, error) {
	return p.repo.GetByID(ctx, id)
}

func (p *PhotoService) Delete(ctx context.Context, id int64) error {
	return p.repo.Delete(ctx, id)
}

func (p *PhotoService) CountByEquipment(ctx context.Context, equipmentID int64) (int, error) {
	return p.repo.CountByEquipment(ctx, equipmentID)
}
