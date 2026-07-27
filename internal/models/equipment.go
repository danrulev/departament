package models

import "time"

type Equipment struct {
	ID                int64      `json:"id" db:"id"`
	Name              string     `json:"name" db:"name"`
	Description       *string    `json:"description,omitempty" db:"description"`
	Location          *string    `json:"location,omitempty" db:"location"`
	Documentation     *string    `json:"documentation,omitempty" db:"documentation"`
	InventoryNumber   *string    `json:"inventory_number,omitempty" db:"inventory_number"`
	ResponsibleID     *string    `json:"responsible_id,omitempty" db:"responsible_id"`
	Status            bool       `json:"status" db:"status"`
	UnavailableReason *string    `json:"unavailable_reason,omitempty" db:"unavailable_reason"` // ← новое
	VerificationDate  *time.Time `json:"verification_date,omitempty" db:"verification_date"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`
}

// EquipmentFilter — параметры фильтрации и пагинации для списка оборудования
type EquipmentFilter struct {
	Search          string `form:"search"`    // ✅ ?search=
	InventoryNumber string `form:"inventory"` // ✅ ?inventory=
	Status          *bool  `form:"-"`         // ✅ игнорируем (парсится вручную)
	Paginated       Paginated
}

type ListEquipment struct {
	PaginatedMetadata PaginatedMetadata `json:"paginated_metadata"`
	Equipment         []Equipment       `json:"equipment"`
}
