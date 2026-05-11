# MyList — Claude instructions

## Stack
- Vanilla JS ES modules (no build step, no bundler)
- Firebase Firestore via CDN (`https://www.gstatic.com/firebasejs/10.7.1/`)
- Three files only: `index.html`, `style.css`, `app.js`
- Deployed as a static site; open directly in browser

## Firestore collections
| Collection | Fields |
|---|---|
| `groceries` | `text`, `category` (string), `completed` (bool), `createdAt` (serverTimestamp) |
| `todos` | `text`, `priority` (high/mid/low/null), `deadline` (YYYY-MM-DD/null), `needsHelp` (bool), `link` (URL string/null), `completed` (bool), `createdAt` (serverTimestamp) |
| `shopping` | `text`, `store` (string), `price` (integer DKK/null), `qty` (integer), `completed` (bool), `createdAt` (serverTimestamp) |
| `projects` | `text`, `deadline` (YYYY-MM-DD/null), `needsHelp` (bool), `completed` (bool), `createdAt` (serverTimestamp) |

## Rendering pattern
- `currentGroceries` / `currentTodos` / `currentShopping` hold the latest snapshot arrays
- `editingGroceryId` / `editingTodoId` / `editingShoppingId` hold the id of the item currently open for inline editing (null otherwise)
- `onSnapshot` callbacks skip re-render while an item is being edited, to avoid wiping the form mid-edit
- All HTML output goes through `escapeHtml()` — never skip this

## Design rules
- Primary colour: `#8b6f47` (warm brown); background: `#f5f0eb`; text: `#2d2d2d`
- Section cards: white, `border-radius: 16px`, subtle shadow
- Input `font-size` must be `1rem` (≥16px) to prevent iOS auto-zoom
- Touch targets for interactive elements: min ~40px on mobile
- Mobile breakpoint: `560px`; safe-area insets already wired up in `body` padding
- Currency formatted with Danish locale: `toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0, maximumFractionDigits: 0 })`
- Prices stored as whole integers (use `Math.round(parseFloat(...))`)

## Pushing to GitHub
Use the stored classic PAT (see memory `reference_github.md`):
```
git -c credential.helper='' push https://x-access-token:<token>@github.com/Mette-Hansen/MyList.git main
```
