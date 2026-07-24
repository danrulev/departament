package handler

import (
	"context"
	"mitm-departament/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AuthService interface {
	SignIn(ctx context.Context, id, password string) (models.TokenOutput, error)
	Logout(ctx context.Context, tokenID string) error
	ParseToken(ctx context.Context, accessToken string) (string, error)
	RefreshToken(ctx context.Context, tokenID string) (models.TokenOutput, error)
}

type AuthHandler struct {
	svc AuthService
	log *zap.Logger
}

func NewAuthHandler(svc AuthService, log *zap.Logger) *AuthHandler {
	return &AuthHandler{svc: svc, log: log}
}

func (h *AuthHandler) RegisterRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")
	{
		auth.POST("/:id", h.signIn)
		auth.POST("/refresh", h.refresh)
		auth.POST("/logout", h.logout)
	}
}

func (h *AuthHandler) signIn(c *gin.Context) {
	id, err := getParamUUID(c, "id")
	if err != nil {
		h.log.Debug("sign in failed: no id",
			zap.String("client_ip", c.ClientIP()),
			zap.Error(err),
		)
		handleError(c, err)
		return
	}

	var password string
	if err := c.ShouldBindJSON(&password); err != nil {
		h.log.Debug("sign in failed: invalid password",
			zap.String("client_ip", c.ClientIP()),
			zap.Error(err),
		)
		handleError(c, err)
		return
	}

	user, err := h.svc.SignIn(c.Request.Context(), id, c.PostForm("password"))
	if err != nil {
		h.log.Debug("sign in failed: invalid credentials",
			zap.String("client_ip", c.ClientIP()),
			zap.Error(err),
		)
		handleError(c, err)
		return
	}

	c.SetCookie(refreshToken, user.RefreshToken, 36000, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{accessToken: user.AccessToken})
}

func (h *AuthHandler) logout(c *gin.Context) {
	refreshTkn, err := getRefreshToken(c)
	if err != nil {
		h.log.Debug("logout failed: no refresh token",
			zap.String("client_ip", c.ClientIP()),
			zap.Error(err),
		)
		handleError(c, err)
		return
	}

	if err := h.svc.Logout(c.Request.Context(), refreshTkn); err != nil {
		h.log.Error("logout failed due to internal error",
			zap.Error(err),
			zap.String("client_ip", c.ClientIP()),
		)
		handleError(c, err)
		return
	}

	h.log.Info("user logged out successfully",
		zap.String("client_ip", c.ClientIP()),
	)

	c.JSON(http.StatusOK, MessageResponse{Message: "logout successful"})
}

func (h *AuthHandler) refresh(c *gin.Context) {
	refreshTkn, err := getRefreshToken(c)
	if err != nil {
		h.log.Debug("refresh failed: no refresh token",
			zap.String("client_ip", c.ClientIP()),
			zap.Error(err),
		)
		handleError(c, err)
		return
	}

	token, err := h.svc.RefreshToken(c.Request.Context(), refreshTkn)
	if err != nil {
		h.log.Error("refresh token failed due to internal error",
			zap.Error(err),
			zap.String("client_ip", c.ClientIP()),
		)
		handleError(c, err)
		return
	}

	h.log.Info("token refreshed successfully",
		zap.String("client_ip", c.ClientIP()),
	)

	c.SetCookie(refreshToken, token.RefreshToken, 36000, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{accessToken: token.AccessToken})
}
