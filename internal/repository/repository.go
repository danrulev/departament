package repository

import (
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Repository struct {
	User      *UserRepo
	Key       *KeyRepo
	KeyLog    *KeyLogRepo
	Equipment *EquipmentRepo
	Token     *TokenR
}

func New(db *sqlx.DB, log *zap.Logger) *Repository {
	return &Repository{
		User:      NewUserRepo(db, log),
		Key:       NewKeyRepo(db, log),
		KeyLog:    NewKeyLogRepo(db, log),
		Equipment: NewEquipmentRepo(db, log),
		Token:     NewTokenRepository(db, log),
	}
}
