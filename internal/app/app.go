package app

import (
	"context"
	"embed"
	"fmt"
	"log"
	"mitm-departament/internal/config"
	"mitm-departament/internal/db"
	"mitm-departament/internal/handler"
	"mitm-departament/internal/models"
	"mitm-departament/internal/repository"
	"mitm-departament/internal/server"
	"mitm-departament/internal/service"
	"mitm-departament/pkg/logger"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

func Start(frontendFS embed.FS) {
	cfg, err := config.NewConfig()
	if err != nil {
		panic(err)
	}

	logInstance, err := logger.New(cfg.Logger)
	if err != nil {
		panic(err)
	}

	dbConn, err := db.New(cfg.DB.LocalPath, logInstance)
	if err != nil {
		logInstance.Fatal("DB connection failed", zap.Error(err))
	}
	logInstance.Info("Database connected", zap.String("path", cfg.DB.LocalPath))

	if err := runMigrations(dbConn, logInstance); err != nil {
		logInstance.Fatal("Migration failed", zap.Error(err))
	}

	logInstance.Info("initializing repository")
	repo := repository.New(dbConn, logInstance)
	svc := service.New(dbConn, repo.User, repo.Token, repo.User, repo.Key, repo.KeyLog, repo.Equipment, repo.Photo, cfg.Auth, logInstance)
	admin_phone := "7(980)3287291"
	admin_email := "danilrulv22@gmail.com"
	svc.User.Create(context.Background(), &models.User{
		ID:       uuid.NewString(),
		FullName: "Rulev Danil ADMIN",
		Password: "12345678",
		Role:     "admin",
		Phone:    &admin_phone,
		Email:    &admin_email,
		IsActive: true,
	})
	user_phone := "7(981)3287291"
	user_email := "danilrulv20@gmail.com"
	svc.User.Create(context.Background(), &models.User{
		ID:       uuid.NewString(),
		FullName: "Rulev Danil STAFF",
		Password: "12345678",
		Role:     "staff",
		Phone:    &user_phone,
		Email:    &user_email,
		IsActive: true,
	})

	handler := handler.New(svc.Auth, svc.User, svc.Key, svc.Equipment, svc.Photo, cfg, logInstance)

	handler.SetFrontendFS(frontendFS)

	srv := server.NewServer(cfg.Server, handler.InitRoutes())

	logInstance.Info("starting server", zap.String("host", cfg.Server.Host), zap.String("port", cfg.Server.Port))
	go func() {
		if err := srv.Start(); err != nil {
			log.Fatal("Server failed", zap.Error(err))
		}
	}()

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = srv.Shutdown(ctx)
	if err != nil {
		log.Fatal("server shutdown failed", zap.Error(err))
	}
}

func runMigrations(dbConn *sqlx.DB, log *zap.Logger) error {
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	execDir := filepath.Dir(execPath)

	paths := []string{
		filepath.Join("internal", "db", "migration"),
		filepath.Join(execDir, "internal", "db", "migration"),
		filepath.Join(execDir, "migration"),
	}

	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			log.Info("Running migrations", zap.String("path", p))
			if err := db.RunMigrations(dbConn, p, log); err != nil {
				return fmt.Errorf("migration failed: %w", err)
			}
			log.Info("Migrations completed")
			return nil
		}
	}

	log.Warn("Migration directory not found - skipping")
	return nil
}
