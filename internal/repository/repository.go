package repository

import (
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Repository struct {
	Article   *ArticleRepo
	User      *UserRepo
	Key       *KeyRepo
	KeyLog    *KeyLogRepo
	Equipment *EquipmentRepo
	Photo     *PhotoRepo
	Token     *TokenR
}

func New(db *sqlx.DB, log *zap.Logger) *Repository {
	return &Repository{
		Article:   NewArticleRepo(db),
		User:      NewUserRepo(db, log),
		Key:       NewKeyRepo(db, log),
		KeyLog:    NewKeyLogRepo(db, log),
		Equipment: NewEquipmentRepo(db, log),
		Photo:     NewPhotoRepo(db, log),
		Token:     NewTokenRepository(db, log),
	}
}
