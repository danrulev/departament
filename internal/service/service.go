package service

import (
	"mitm-departament/pkg/hasher"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type HasherI interface {
	GenerateHash(password string) (string, error)
	ComparePassword(hash string, password string) error
}

type Service struct {
	User      *UserService
	Key       *KeyService
	Equipment *EquipmentService
}

func New(
	db *sqlx.DB,
	userRepo UserRepo,
	keyRepo KeyRepo,
	keyLogRepo KeyLogRepo,
	equipmentRepo EquipmentRepo,

	log *zap.Logger,
) *Service {
	hasher := hasher.NewHasher()
	return &Service{
		User:      NewUserService(userRepo, hasher, log),
		Key:       NewKeyService(keyRepo, keyLogRepo, db, log),
		Equipment: NewEquipmentService(equipmentRepo, log),
	}
}
