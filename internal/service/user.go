package service

import (
	"context"
	"fmt"

	"mitm-departament/internal/models"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// UserRepo — интерфейс репозитория пользователей
type UserRepo interface {
	Create(ctx context.Context, u *models.User) error
	GetByID(ctx context.Context, id string) (*models.User, error)
	ListActive(ctx context.Context) ([]models.User, error)
	Update(ctx context.Context, u *models.User) error
}

type UserService struct {
	repo   UserRepo
	hasher HasherI
	log    *zap.Logger
}

func NewUserService(repo UserRepo, hasher HasherI, log *zap.Logger) *UserService {
	return &UserService{repo: repo, hasher: hasher, log: log}
}

// Create создаёт пользователя. UUID генерируется здесь.
func (s *UserService) Create(ctx context.Context, u *models.User) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}

	var err error
	u.Password, err = s.hasher.GenerateHash(u.Password)
	if err != nil {
		s.log.Error("failed to generate hash for password",
			zap.String("user_id", u.ID),
			zap.Error(err),
		)
		return fmt.Errorf("generate hash for password: %w", err)
	}

	if err := s.repo.Create(ctx, u); err != nil {
		s.log.Error("failed to create user",
			zap.String("user_id", u.ID),
			zap.Error(err),
		)
		return fmt.Errorf("create user: %w", err)
	}

	s.log.Info("user created",
		zap.String("user_id", u.ID),
		zap.String("full_name", u.FullName),
	)
	return nil
}

// GetByID возвращает пользователя по UUID
func (s *UserService) GetByID(ctx context.Context, id string) (*models.User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	if u == nil {
		return nil, fmt.Errorf("user %s not found", id)
	}
	return u, nil
}

// ListActive возвращает всех активных пользователей
func (s *UserService) ListActive(ctx context.Context) ([]models.User, error) {
	users, err := s.repo.ListActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("list active users: %w", err)
	}
	return users, nil
}

// Update обновляет данные пользователя
func (s *UserService) Update(ctx context.Context, u *models.User) error {
	if u.ID == "" {
		return fmt.Errorf("user id is required for update")
	}

	if err := s.repo.Update(ctx, u); err != nil {
		s.log.Error("failed to update user",
			zap.String("user_id", u.ID),
			zap.Error(err),
		)
		return fmt.Errorf("update user: %w", err)
	}

	s.log.Info("user updated", zap.String("user_id", u.ID))
	return nil
}

// Deactivate деактивирует пользователя (уволился/выпустился)
func (s *UserService) Deactivate(ctx context.Context, id string) error {
	u, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	u.IsActive = false
	return s.Update(ctx, u)
}
