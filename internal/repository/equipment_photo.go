// internal/repository/equipment_photo.go

package repository

import (
	"context"
	"database/sql"
	"fmt"
	"mitm-departament/internal/models"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type PhotoRepo struct {
	db  *sqlx.DB
	log *zap.Logger
}

func NewPhotoRepo(db *sqlx.DB, log *zap.Logger) *PhotoRepo {
	return &PhotoRepo{db: db, log: log}
}

func (r *PhotoRepo) Create(ctx context.Context, p *models.EquipmentPhoto) error {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO equipment_photos (equipment_id, filename, stored_name, content_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
		p.EquipmentID, p.Filename, p.StoredName, p.ContentType, p.SizeBytes, p.UploadedBy,
	)
	if err != nil {
		return fmt.Errorf("insert photo: %w", err)
	}
	p.ID, _ = res.LastInsertId()
	return nil
}

func (r *PhotoRepo) ListByEquipment(ctx context.Context, equipmentID int64) ([]models.EquipmentPhoto, error) {
	var photos []models.EquipmentPhoto
	err := r.db.SelectContext(ctx, &photos,
		`SELECT id, equipment_id, filename, stored_name, content_type, size_bytes, uploaded_by, created_at
         FROM equipment_photos WHERE equipment_id = ? ORDER BY created_at`, equipmentID)
	if err != nil {
		return nil, fmt.Errorf("list photos: %w", err)
	}
	return photos, nil
}

func (r *PhotoRepo) GetByID(ctx context.Context, id int64) (*models.EquipmentPhoto, error) {
	p := &models.EquipmentPhoto{}
	err := r.db.GetContext(ctx, p,
		`SELECT id, equipment_id, filename, stored_name, content_type, size_bytes, uploaded_by, created_at
         FROM equipment_photos WHERE id = ?`, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get photo: %w", err)
	}
	return p, nil
}

func (r *PhotoRepo) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM equipment_photos WHERE id = ?`, id)
	return err
}

func (r *PhotoRepo) CountByEquipment(ctx context.Context, equipmentID int64) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM equipment_photos WHERE equipment_id = ?`, equipmentID)
	return count, err
}
