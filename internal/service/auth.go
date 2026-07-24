package service

import (
	"context"
	"fmt"
	"mitm-departament/internal/config"
	"mitm-departament/internal/models"

	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/jwa"
	"github.com/lestrrat-go/jwx/v2/jwt"

	"go.uber.org/zap"
)

type AuthUserRepo interface {
	GetByID(ctx context.Context, id string) (*models.User, error)
	GetCredentials(ctx context.Context, id string) (*models.User, error)
}

type TokeRepo interface {
	CreateToken(ctx context.Context, token models.Token) error
	Token(ctx context.Context, tokenID string) (models.Token, error)
	DeleteToken(ctx context.Context, tokenID string) error
}

type AuthS struct {
	userRepo  AuthUserRepo
	tokenRepo TokeRepo
	hasher    HasherI
	token     config.AuthCfg
	log       *zap.Logger
}

func NewAuthService(
	userRepo AuthUserRepo,
	tokenRepo TokeRepo,
	token config.AuthCfg,

	hasher HasherI,
	log *zap.Logger,
) *AuthS {
	return &AuthS{
		userRepo:  userRepo,
		tokenRepo: tokenRepo,
		token:     token,
		log:       log,
	}
}

func (a *AuthS) SignIn(ctx context.Context, id, password string) (models.TokenOutput, error) {
	user, err := a.userRepo.GetCredentials(ctx, id)
	if err != nil {
		return models.TokenOutput{}, err
	}

	if user.Password != "" {
		if err := a.hasher.ComparePassword(user.Password, password); err != nil {
			return models.TokenOutput{}, err
		}
	}

	token, err := a.generateAndSaveTokens(ctx, user.ID)
	if err != nil {
		a.log.Error("failed to generate or save tokens",
			zap.String("user_id", user.ID),
			zap.Error(err),
		)
		return models.TokenOutput{}, err
	}

	return token, nil
}

func (a *AuthS) Logout(ctx context.Context, tokenID string) error {
	if err := a.tokenRepo.DeleteToken(ctx, tokenID); err != nil {
		a.log.Error("failed to delete refresh token during logout",
			zap.String("token_id", tokenID),
			zap.Error(err),
		)
		return err
	}

	a.log.Info("user logged out successfully",
		zap.String("token_id", tokenID),
	)

	return nil
}

func (a *AuthS) generateAndSaveTokens(ctx context.Context, userID string) (models.TokenOutput, error) {
	accessToken, refreshToken, err := a.generateTokens(userID)
	if err != nil {
		return models.TokenOutput{}, err
	}

	if err := a.tokenRepo.CreateToken(ctx, refreshToken); err != nil {
		return models.TokenOutput{}, err
	}

	return models.TokenOutput{
		AccessToken:  accessToken,
		RefreshToken: refreshToken.TokenID,
	}, nil
}

func (a *AuthS) generateTokens(userID string) (string, models.Token, error) {
	accessToken, err := a.generateAccessToken(userID)
	if err != nil {
		return "", models.Token{}, err
	}

	refreshToken := a.generateRefreshToken(userID)
	return accessToken, refreshToken, nil
}

func (a *AuthS) generateAccessToken(userID string) (string, error) {
	tkn := jwt.New()
	if err := tkn.Set(jwt.SubjectKey, userID); err != nil {
		return "", fmt.Errorf("failed to set subject in token: %w", err)
	}

	if err := tkn.Set(jwt.ExpirationKey, time.Now().Add(a.token.AccessTokenTTL)); err != nil {
		return "", fmt.Errorf("failed to set expiration in token: %w", err)
	}

	if err := tkn.Set(jwt.IssuedAtKey, time.Now()); err != nil {
		return "", fmt.Errorf("failed to set issued at in token: %w", err)
	}

	accessToken, err := jwt.Sign(tkn, jwt.WithKey(jwa.HS256, []byte(a.token.JwtSecret)))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %s", err)
	}

	return string(accessToken), nil
}

func (a *AuthS) generateRefreshToken(userID string) models.Token {
	return models.Token{
		UserID:    userID,
		TokenID:   uuid.New().String(),
		ExpiresAt: time.Now().Add(a.token.RefreshTokenTTL),
	}
}

func (a *AuthS) ParseToken(ctx context.Context, accessToken string) (string, error) {
	verified, err := jwt.Parse([]byte(accessToken), jwt.WithKey(jwa.HS256, []byte(a.token.JwtSecret)))
	if err != nil {
		a.log.Debug("failed to parse or verify access token",
			zap.Error(err),
		)
		return "", fmt.Errorf("invalid token")
	}

	subject, ok := verified.Get(jwt.SubjectKey)
	if !ok {
		a.log.Debug("token missing 'sub' claim")
		return "", fmt.Errorf("invalid token")
	}

	subjectStr, ok := subject.(string)
	if !ok {
		a.log.Debug("token 'sub' claim is not a string")
		return "", fmt.Errorf("invalid token")
	}

	_, err = uuid.Parse(subjectStr)
	if err != nil {
		a.log.Debug("invalid user ID in token",
			zap.String("subject", subjectStr),
			zap.Error(err),
		)
		return "", err
	}

	return subjectStr, nil
}

func (a *AuthS) RefreshToken(ctx context.Context, tokenID string) (models.TokenOutput, error) {
	tokenDB, err := a.tokenRepo.Token(ctx, tokenID)
	if err != nil {
		return models.TokenOutput{}, err
	}

	if err := a.tokenRepo.DeleteToken(ctx, tokenID); err != nil {
		a.log.Error("failed to delete old refresh token",
			zap.String("token_id", tokenID),
			zap.Error(err),
		)
		return models.TokenOutput{}, err
	}

	if tokenDB.ExpiresAt.Before(time.Now()) {
		a.log.Warn("attempt to refresh expired token",
			zap.String("token_id", tokenID),
			zap.Time("expires_at", tokenDB.ExpiresAt),
		)
		return models.TokenOutput{}, fmt.Errorf("token expired")
	}

	token, err := a.generateAndSaveTokens(ctx, tokenDB.UserID)
	if err != nil {
		a.log.Error("failed to generate new tokens during refresh",
			zap.String("user_id", tokenDB.UserID),
			zap.Error(err),
		)
		return models.TokenOutput{}, err
	}

	a.log.Info("token refreshed successfully",
		zap.String("user_id", tokenDB.UserID),
		zap.String("old_token_id", tokenID),
		zap.String("new_refresh_token_id", token.RefreshToken),
	)

	return token, nil
}
