package service

import (
	"context"
	"mitm-departament/internal/models"

	"go.uber.org/zap"
)

type EventRepo interface {
	CreateEvent(ctx context.Context, event models.Event) (int64, error)
	Event(ctx context.Context, id int64) (*models.Event, error)
	EventsList(ctx context.Context, f models.EventFilter) ([]models.Event, int64, error)
	UpdateEvent(ctx context.Context, event *models.Event, id int64) error
	DeleteEvent(ctx context.Context, eventID int64) error
}

type EventService struct {
	repo EventRepo
	log  *zap.Logger
}

func NewEventService(repo EventRepo, log *zap.Logger) *EventService {
	return &EventService{
		repo: repo,
		log:  log,
	}
}
