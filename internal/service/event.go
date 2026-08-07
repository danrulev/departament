package service

import (
	"context"
	"errors"
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

func (s *EventService) CreateEvent(ctx context.Context, event models.Event) (int64, error) {
	return s.repo.CreateEvent(ctx, event)
}

func (s *EventService) Event(ctx context.Context, id int64) (*models.Event, error) {
	return s.repo.Event(ctx, id)
}

func (s *EventService) EventsList(ctx context.Context, f models.EventFilter) (models.EventList, error) {
	if f.Paginated.Limit <= 0 {
		f.Paginated.Limit = 20
	}
	if f.Paginated.Limit > 100 {
		f.Paginated.Limit = 100 // защита от слишком больших запросов
	}
	if f.Paginated.Offset < 0 {
		f.Paginated.Offset = 0
	}

	events, total, err := s.repo.EventsList(ctx, f)
	if err != nil {
		return models.EventList{}, err
	}

	return models.EventList{
		Events:            events,
		PaginatedMetadata: models.MakePaginatedMetadata(f.Paginated.Limit, f.Paginated.Offset, total),
	}, nil
}

func (s *EventService) UpdateEvent(ctx context.Context, id int64, u *models.Event) error {
	if u.ID == 0 {
		return errors.New("equipment id is required for update")
	}
	return s.repo.UpdateEvent(ctx, u, id)
}

func (s *EventService) DeleteEvent(ctx context.Context, id int64) error {
	return s.repo.DeleteEvent(ctx, id)
}
