package service

import (
	"mitm-departament/internal/config"
	"mitm-departament/pkg/hasher"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type HasherI interface {
	GenerateHash(password string) (string, error)
	ComparePassword(hash string, password string) error
}

type Service struct {
	Auth      *AuthS
	Article   *ArticleS
	User      *UserService
	Key       *KeyService
	Equipment *EquipmentService
	Photo     *PhotoService
}

func New(
	db *sqlx.DB,
	authUserRepo AuthUserRepo,
	articleRepo ArticleRepository,
	tokenRepo TokeRepo,
	userRepo UserRepo,
	keyRepo KeyRepo,
	keyLogRepo KeyLogRepo,
	equipmentRepo EquipmentRepo,
	photo PhotoRepo,

	token config.AuthCfg,
	log *zap.Logger,
) *Service {
	hasher := hasher.NewHasher()
	return &Service{
		Auth:      NewAuthService(authUserRepo, tokenRepo, token, hasher, log),
		Article:   NewArticleService(articleRepo, log),
		User:      NewUserService(userRepo, hasher, log),
		Key:       NewKeyService(keyRepo, keyLogRepo, db, log),
		Equipment: NewEquipmentService(equipmentRepo, log),
		Photo:     NewPhotoService(photo, log),
	}
}
