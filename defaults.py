"""Default categories created for every new account."""

from __future__ import annotations

DEFAULT_CATEGORIES = [
    ("Food & Dining", "#f97316", "🍔"),
    ("Transport", "#3b82f6", "🚗"),
    ("Shopping", "#ec4899", "🛍️"),
    ("Bills & Utilities", "#eab308", "💡"),
    ("Health", "#10b981", "🩺"),
    ("Entertainment", "#8b5cf6", "🎬"),
    ("Education", "#06b6d4", "📚"),
    ("Travel", "#14b8a6", "✈️"),
    ("Other", "#64748b", "📦"),
]


def seed_default_categories(cursor, user_id: int) -> None:
    """Insert the starter categories for a user, ignoring duplicates."""
    cursor.executemany(
        """
        INSERT INTO categories (user_id, name, color, icon)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
        """,
        [(user_id, name, color, icon) for name, color, icon in DEFAULT_CATEGORIES],
    )
