---
ID: ADOPT-01-FIX-MD
TITLE: Broken Markdown Fixture
VERSION: 1.0.0
STATUS: ACTIVE
OWNER: Architecture Team
---

# Broken Markdown Fixture (MD-01)

## 

An empty heading appears above this line.

An empty link target: [click here]() and an empty image: ![]().

Malformed embedded JSON:

```json
{ "unclosed": true,
```

An unclosed code fence follows and is never terminated.

```python
print("this fence is never closed")
