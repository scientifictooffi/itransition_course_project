import { FormEvent, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";

import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { InventoryPage } from "./pages/InventoryPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SearchResultsPage } from "./pages/SearchResultsPage";

type Theme = "light" | "dark";
type Language = "en" | "ru";

const App: React.FC = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("en");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleLanguageChange = (value: Language) => {
    setLanguage(value);
  };

  return (
    <div className={`app app--${theme}`}>
      <header className="app-header">
        <div className="app-header__left">
          <Link to="/" className="app-logo">
            Inventory Manager
          </Link>
        </div>

        <form className="app-header__search" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            placeholder={
              language === "en" ? "Search inventories and items..." : "Поиск по инвентарям и элементам..."
            }
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </form>

        <div className="app-header__right">
          <select
            className="app-header__select"
            value={language}
            onChange={(event) => handleLanguageChange(event.target.value as Language)}
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>

          <button type="button" className="app-header__theme-toggle" onClick={toggleTheme}>
            {theme === "light" ? "🌞" : "🌙"}
          </button>

          <Link to="/profile" className="me-2">
            <button type="button" className="app-header__auth-button">
              {language === "en" ? "My page" : "Моя страница"}
            </button>
          </Link>

          <Link to="/login">
            <button type="button" className="app-header__auth-button">
              {language === "en" ? "Sign in" : "Войти"}
            </button>
          </Link>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage language={language} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/inventories/:id" element={<InventoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
