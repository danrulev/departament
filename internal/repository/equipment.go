package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"mitm-departament/internal/models"
	"strings"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type EquipmentRepo struct {
	db  *sqlx.DB
	log *zap.Logger
}

func NewEquipmentRepo(db *sqlx.DB, log *zap.Logger) *EquipmentRepo {
	return &EquipmentRepo{db: db, log: log}
}

// equipmentColumns — список колонок для SELECT (без JOIN)
const equipmentColumns = `id, name, description, location, documentation, inventory_number,
	responsible_id, status, unavailable_reason, last_verification_date, next_verification_date, created_at, updated_at`

// Create создаёт единицу оборудования
func (r *EquipmentRepo) Create(ctx context.Context, e *models.Equipment) error {
	res, err := r.db.NamedExecContext(ctx,
		`INSERT INTO equipment 
			(name, description, location, documentation, inventory_number, responsible_id, status, unavailable_reason, last_verification_date, next_verification_date)
		 VALUES 
			(:name, :description, :location, :documentation, :inventory_number, :responsible_id, :status, :unavailable_reason, :last_verification_date, :next_verification_date)`, e)
	if err != nil {
		return fmt.Errorf("insert equipment: %w", err)
	}
	id, _ := res.LastInsertId()
	e.ID = id
	return nil
}

// GetByID возвращает оборудование по ID
func (r *EquipmentRepo) GetByID(ctx context.Context, id int64) (*models.Equipment, error) {
	e := &models.Equipment{}
	err := r.db.GetContext(ctx, e,
		`SELECT `+equipmentColumns+` FROM equipment WHERE id = ?`, id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get equipment: %w", err)
	}
	return e, nil
}

// GetByInventoryNumber возвращает оборудование по точному инвентарному номеру
func (r *EquipmentRepo) GetByInventoryNumber(ctx context.Context, invNumber string) (*models.Equipment, error) {
	e := &models.Equipment{}
	err := r.db.GetContext(ctx, e,
		`SELECT `+equipmentColumns+` FROM equipment WHERE inventory_number = ?`, invNumber)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get equipment by inventory number: %w", err)
	}
	return e, nil
}

// List возвращает список оборудования с фильтрами, пагинацией и общим количеством.
//   - Search:          поиск по названию (LIKE %search%)
//   - InventoryNumber: поиск по инвентарному номеру (LIKE inventory%)
//   - Status:          фильтр по статусу (nil = без фильтра)
//   - Limit / Offset:  пагинация
func (r *EquipmentRepo) List(ctx context.Context, f models.EquipmentFilter) ([]models.Equipment, int64, error) {
	// Динамически собираем условия WHERE
	var conditions []string
	var args []interface{}

	if f.Search != "" {
		conditions = append(conditions, "name LIKE ?")
		args = append(args, "%"+f.Search+"%") // содержит
	}

	if f.InventoryNumber != "" {
		conditions = append(conditions, "inventory_number LIKE ?")
		args = append(args, f.InventoryNumber+"%") // начинается с
	}

	if f.Status != nil {
		conditions = append(conditions, "status = ?")
		args = append(args, *f.Status)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// 1. Общее количество записей под фильтр
	var total int64
	countQuery := `SELECT COUNT(*) FROM equipment` + whereClause
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, fmt.Errorf("count equipment: %w", err)
	}

	if total == 0 {
		return nil, 0, nil
	}

	// 2. Сами записи с пагинацией
	listArgs := make([]interface{}, 0, len(args)+2)
	listArgs = append(listArgs, args...)
	listArgs = append(listArgs, f.Paginated.Limit, f.Paginated.Offset)

	var items []models.Equipment
	listQuery := `SELECT ` + equipmentColumns + ` FROM equipment` + whereClause + ` ORDER BY id LIMIT ? OFFSET ?`
	if err := r.db.SelectContext(ctx, &items, listQuery, listArgs...); err != nil {
		return nil, 0, fmt.Errorf("list equipment: %w", err)
	}

	return items, total, nil
}

// ListExpiredVerification возвращает оборудование с просроченной поверкой
func (r *EquipmentRepo) ListExpiredVerification(ctx context.Context, limit, offset int64) ([]models.Equipment, int64, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM equipment WHERE next_verification_date IS NOT NULL AND next_verification_date < DATE('now')`
	if err := r.db.GetContext(ctx, &total, countQuery); err != nil {
		return nil, 0, fmt.Errorf("count equipment: %w", err)
	}

	if total == 0 {
		return nil, 0, nil
	}

	var items []models.Equipment
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+equipmentColumns+` FROM equipment 
		 WHERE next_verification_date IS NOT NULL AND next_verification_date < DATE('now')
		 ORDER BY next_verification_date`)
	if err != nil {
		return nil, 0, fmt.Errorf("list expired verification: %w", err)
	}
	return items, total, nil
}

// Update обновляет данные оборудования
func (r *EquipmentRepo) Update(ctx context.Context, e *models.Equipment) error {
	res, err := r.db.NamedExecContext(ctx,
		`UPDATE equipment SET 
			name = :name,
			description = :description,
			location = :location,
			documentation = :documentation,
			inventory_number = :inventory_number,
			responsible_id = :responsible_id,
			status = :status,
			unavailable_reason = :unavailable_reason,
			last_verification_date = :last_verification_date,
			next_verification_date = :next_verification_date,
			updated_at = CURRENT_TIMESTAMP
		 WHERE id = :id`, e)
	if err != nil {
		return fmt.Errorf("update equipment: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("equipment not found")
	}
	return nil
}

// Delete удаляет оборудование
func (r *EquipmentRepo) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM equipment WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete equipment: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("equipment not found")
	}
	return nil
}
