package models

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
)

type Token struct {
	UserID    string
	TokenID   string
	ExpiresAt time.Time
}

type TokenClaims struct {
	UserID string
	jwt.StandardClaims
}

type TokenOutput struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func (t Token) Validate() error {
	if t.UserID == "" {
		return fmt.Errorf("invalid token user ID")
	}

	if t.TokenID == uuid.Nil.String() {
		return fmt.Errorf("invalid token ID")
	}

	if t.ExpiresAt.Before(time.Now()) {
		return fmt.Errorf("invalid expires")
	}

	return nil
}
