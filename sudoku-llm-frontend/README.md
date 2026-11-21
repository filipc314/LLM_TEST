# Sudoku AI Frontend

React 18 i Vite. Aplikacja pozwala wprowadzić sudoku 9×9, wykrywa konflikty i pokazuje rozwiązanie z rozróżnieniem wskazówek i wpisów solvera.

## Uruchomienie

W tym katalogu uruchom `npm ci` oraz `npm run dev`. Otwórz `http://localhost:3000`. Instrukcja uruchomienia serwera Python i opis API znajdują się w [README projektu](../README.md).

Wybierz **Classic MRV**, **MRV + SmolLM2 135M** albo **MRV + SmolLM2 360M** i kliknij **Solve**. **Compare all methods** wykonuje kolejno trzy żądania dla bieżących wskazówek i pokazuje wyniki w jednej tabeli. Liczniki pochodzą z pola `stats` odpowiedzi API. **Reset to Clues** usuwa wpisy solvera, a **Clear Board** czyści całą planszę.

**Backend Settings** pozwala zmienić endpoint i opcjonalnie wysłać token Bearer. Domyślny adres to `http://localhost:8000/api/solve-sudoku`. Klient wysyła planszę jako `GRID_2D`. Aby rozwiązać sudoku bez serwera, włącz **Enable Local Mock Simulation**.

## Podgląd bez npm

W tym katalogu uruchom `python3 -m http.server 3000` i otwórz `http://localhost:3000/standalone.html`. Wersja podglądowa potrzebuje internetu do załadowania Reacta i Babel z CDN. Startuje w trybie Mock. Po jego wyłączeniu korzysta z tego samego klienta API.

## Weryfikacja

`npm test` sprawdza klienta API i renderowanie Reacta. Z uruchomionym serwerem ustaw `SUDOKU_TEST_ENDPOINT=http://localhost:8000/api/solve-sudoku`, aby dołączyć test wszystkich trzech metod przez HTTP. `npm run build` tworzy wersję produkcyjną w katalogu `dist/`.
