package models

import "time"

// internal/models/user.go
type User struct {
	ID        string    `json:"id" db:"id"`
	Avatar    *string   `json:"avatar,omitempty" db:"avatar"`
	FullName  string    `json:"full_name" db:"full_name"`
	Password  string    `json:"-" db:"password"`
	Role      string    `json:"role" db:"role"`
	Position  *string   `json:"position,omitempty" db:"position"` // должность
	Phone     *string   `json:"phone,omitempty" db:"phone"`
	Email     *string   `json:"email,omitempty" db:"email"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
