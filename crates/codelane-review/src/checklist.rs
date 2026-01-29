//! Review checklists

use serde::{Deserialize, Serialize};

/// A checklist item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistItem {
    /// Item description
    pub description: String,

    /// Is this item checked?
    pub checked: bool,

    /// Is this item required?
    pub required: bool,
}

/// A review checklist
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checklist {
    /// Checklist items
    pub items: Vec<ChecklistItem>,
}

impl Checklist {
    /// Create a default code review checklist
    pub fn default_review() -> Self {
        Self {
            items: vec![
                ChecklistItem {
                    description: "Code follows project style guidelines".to_string(),
                    checked: false,
                    required: true,
                },
                ChecklistItem {
                    description: "Tests are included for new functionality".to_string(),
                    checked: false,
                    required: true,
                },
                ChecklistItem {
                    description: "Documentation is updated".to_string(),
                    checked: false,
                    required: false,
                },
                ChecklistItem {
                    description: "No security vulnerabilities introduced".to_string(),
                    checked: false,
                    required: true,
                },
                ChecklistItem {
                    description: "Performance implications considered".to_string(),
                    checked: false,
                    required: false,
                },
            ],
        }
    }

    /// Check if all required items are checked
    pub fn is_complete(&self) -> bool {
        self.items
            .iter()
            .filter(|item| item.required)
            .all(|item| item.checked)
    }
}
