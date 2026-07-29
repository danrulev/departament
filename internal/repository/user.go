package repository

import (
	"context"
	"database/sql"
	"fmt"
	"mitm-departament/internal/models"
	"time"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type UserRepo struct {
	db  *sqlx.DB
	log *zap.Logger
}

func NewUserRepo(db *sqlx.DB, log *zap.Logger) *UserRepo {
	return &UserRepo{db: db, log: log}
}

// Create создаёт пользователя
func (r *UserRepo) Create(ctx context.Context, u *models.User) error {
	u.CreatedAt = time.Now()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO users (id, avatar, full_name, password, role, position, phone, email, is_active)
		 VALUES (:id, :avatar, :full_name, :password, :role, :position, :phone, :email, :is_active)`, u)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}
	return nil
}

// GetByID возвращает пользователя по UUID
func (r *UserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	u := &models.User{}
	err := r.db.GetContext(ctx, u,
		`SELECT id, full_name, role, position, phone, email, is_active, avatar, created_at
         FROM users WHERE id = ?`, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return u, nil
}

func (r *UserRepo) GetCredentials(ctx context.Context, email string) (*models.User, error) {
	u := &models.User{}
	err := r.db.GetContext(ctx, u,
		`SELECT id, full_name, password, role, phone, email, is_active, created_at
         FROM users WHERE email = ? AND is_active = 1`, email)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}
	return u, nil
}

// List возвращает всех пользователей
func (r *UserRepo) List(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := r.db.SelectContext(ctx, &users,
		`SELECT id, full_name, role, phone, email, is_active, created_at
		 FROM users ORDER BY full_name`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

// ListActive возвращает всех активных пользователей
func (r *UserRepo) ListActive(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := r.db.SelectContext(ctx, &users,
		`SELECT id, full_name, role, phone, email, is_active, created_at
		 FROM users WHERE is_active = 1 ORDER BY full_name`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

func (r *UserRepo) GetByName(ctx context.Context, name string) ([]models.User, error) {
	var users []models.User
	err := r.db.SelectContext(ctx, &users,
		`SELECT id, full_name, role, phone, email, is_active, created_at
		 FROM users WHERE name like %?% ORDER BY full_name`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

// Update обновляет данные пользователя
func (r *UserRepo) Update(ctx context.Context, u *models.User) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE users SET
			avatar = :avatar,
			full_name = :full_name,
			role = :role,
			position = :position, 
			phone = :phone,
			email = :email,
			is_active = :is_active
		 WHERE id = :id`, u)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}
	return nil
}

func (r *UserRepo) SetAvatar(ctx context.Context, userID, filename string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET avatar = ? WHERE id = ?`, filename, userID)
	if err != nil {
		return fmt.Errorf("set avatar: %w", err)
	}
	return nil
}
