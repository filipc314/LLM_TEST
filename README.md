# Sudoku AI

Aplikacja rozwiązuje sudoku 9×9 na trzy sposoby: klasycznym backtrackingiem z MRV, backtrackingiem wspomaganym przez SmolLM2-135M-Instruct lub backtrackingiem wspomaganym przez SmolLM2-360M-Instruct. W interfejsie można rozwiązać planszę wybraną metodą albo porównać wszystkie trzy na tych samych wskazówkach.

## Architektura

| Plik lub katalog | Odpowiedzialność |
| --- | --- |
| `sudoku-llm-frontend/` | React 18 i Vite. Edycja planszy, wybór metody, prezentacja rozwiązania i porównanie statystyk. |
| `backend/server.py` | Lokalny serwer HTTP Python `wsgiref`, obsługa CORS, kontrakt JSON i wybór metody. |
| `backend/solver.py` | Walidacja sudoku, wybór pola MRV, backtracking i liczniki. |
| `backend/model.py` | Ładowanie tokenizera i wag, budowanie promptu, lokalna inferencja przez PyTorch i Transformers, walidacja sugestii. Raz załadowany model jest używany w kolejnych żądaniach. |
| `backend/benchmark.py`, `benchmark/` | Zestaw plansz, skrypt porównawczy i surowe pomiary JSON. |

## Instalacja i uruchomienie

Potrzebujesz Pythona 3.11 lub nowszego z kołem PyTorch dla używanej platformy oraz Node.js z npm. Projekt sprawdzono na macOS arm64 z Pythonem 3.14.5. PyTorch 2.15 wymaga macOS 15 lub nowszego do korzystania z MPS. [Dokumentacja MPS](https://docs.pytorch.org/docs/2.15/notes/mps.html) · [Wydanie PyTorch 2.15](https://pytorch.org/blog/pytorch-2-15-release-blog/)

Z katalogu projektu uruchom backend w pierwszym terminalu:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
export HF_HOME="$PWD/.hf-cache"
python backend/server.py
```

W drugim terminalu uruchom frontend:

```sh
cd sudoku-llm-frontend
npm ci
npm run dev
```

Otwórz `http://localhost:3000`. W sekcji **Solving method** wybierz metodę i kliknij **Solve** albo **Compare all methods**. Domyślnym trybem jest **Classic MRV**, który działa także bez wag i pakietów modelu. Tryb **Mock** w ustawieniach uruchamia dotychczasowy solver przeglądarkowy.

Backend w trybie `auto` wybiera MPS z FP16, gdy jest dostępny, a w pozostałych przypadkach CPU z FP32. Urządzenie można wybrać jawnie przez `SUDOKU_DEVICE=cpu` lub `SUDOKU_DEVICE=mps`. Pierwsze użycie modelu pobiera przypiętą wersję publicznych wag z Hugging Face. Pobranie obu modeli wymaga około 1 GB na wagi. Po zapisaniu wag można uruchomić serwer z `HF_HUB_OFFLINE=1`, zachowując ten sam katalog `HF_HOME`.

## Algorytm i modele

MRV (*minimum remaining values*) wybiera puste pole z najmniejszą liczbą legalnych kandydatów. Brak kandydata kończy bieżącą gałąź. Przy jednym kandydacie solver wstawia cyfrę od razu. Przy kilku kandydatów tryb klasyczny sprawdza ich rosnąco, a tryb hybrydowy przedstawia modelowi aktualną planszę, pole i listę dopuszczalnych cyfr. Prompt kończy się początkiem odpowiedzi `Answer:`. Model generuje zachłannie do trzech tokenów, a parser akceptuje pojedynczą cyfrę z listy dopuszczalnych wartości.

Poprawna sugestia przesuwa cyfrę na początek kolejki. Po ślepej uliczce solver cofa wpis i sprawdza pozostałe cyfry. Błędna sugestia lub błąd inferencji przywraca kolejność rosnącą i zwiększa odpowiedni licznik. Mechanizm przeszukiwania pozostaje wyczerpujący, więc sugestia może zmienić koszt znalezienia rozwiązania, a poprawność nadal zapewniają reguły sudoku.

135M i 360M to dwa modele instrukcyjne z tej samej rodziny. Oba mieszczą się w wymaganym przedziale od 50M do 4B parametrów. Wspólna rodzina i sposób generowania pozwalają porównać wpływ wielkości modelu bez zmiany algorytmu solvera i formatu promptu. [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) · [SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct)

## REST API

`POST http://localhost:8000/api/solve-sudoku` przyjmuje JSON z `format: "GRID_2D"` oraz `sudoku_board`, czyli macierzą 9×9 liczb od 0 do 9. Zero oznacza puste pole.

| Tryb | `method` | `model` |
| --- | --- | --- |
| Klasyczny | `classic` lub brak pola | `null` lub brak pola |
| SmolLM2 135M | `hybrid` | `smollm2-135m` |
| SmolLM2 360M | `hybrid` | `smollm2-360m` |

Sukces zwraca `200` z pełną macierzą `solution`, wybraną metodą, modelem i `stats`. Pola statystyk:

- `elapsed_ms` obejmuje pracę solvera, w tym inferencję. Ładowanie modelu odbywa się przed rozpoczęciem pomiaru.
- `attempts` i `backtracks` liczą odpowiednio próbne wpisy i wpisy wycofane.
- `model_calls` liczy wywołania modelu na rozgałęzieniach.
- `invalid_model_responses` liczy odpowiedzi o błędnym formacie lub z niedozwoloną cyfrą. `model_errors` liczy awarie inferencji.

Błędy mają pola `code` i `message`. Wadliwy JSON zwraca `400`, błędne dane lub brak rozwiązania `422`, a nieudane ładowanie modelu `503`. Odpowiedź `UNSOLVABLE` zawiera statystyki zakończonego wyszukiwania.

## Benchmark

Zestaw zawiera 30 różnych plansz z unikatowymi rozwiązaniami, po 10 łatwych, średnich i trudnych. Jest generowany z ustalonym ziarnem `2953`; każdą usuniętą wskazówkę sprawdzano pod kątem utrzymania unikatowości. Trudność określono na podstawie liczby wskazówek i liczby cofnięć klasycznej metody na tej planszy. Każda metoda rozwiązywała identyczne plansze. Poprawność sprawdzano według reguł sudoku i zgodności ze wszystkimi wskazówkami.

Pomiar wykonano na Apple Silicon (macOS 27.0.1, PyTorch 2.15.0, Transformers 5.21.0). Modele działały przez MPS w FP16, z uprzednio zapisanymi wagami i jedną inferencją rozgrzewkową poza pomiarem rozwiązywania. Czasy ładowania poniżej to pojedyncze pomiary w tej samej kolejności, więc pierwszy model mógł ponieść koszt inicjalizacji środowiska. Pamięć parametrów oznacza wielkość samych tensorów wag, bez pozostałej pamięci procesu.

| Metoda | Poprawne | Próby | Cofnięcia | Wywołania LLM | Błędne odpowiedzi | Suma czasów solvera | Mediana na planszę |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Klasyczny MRV | 30/30 | 2343 | 919 | 0 | 0 | 67,8 ms | 1,92 ms |
| MRV + SmolLM2 135M | 30/30 | 2301 | 877 | 126 | 0 | 3749,0 ms | 91,99 ms |
| MRV + SmolLM2 360M | 30/30 | 2463 | 1039 | 150 | 0 | 8130,4 ms | 182,42 ms |

| Model | Parametry | Wagi w pamięci (FP16) | Czas ładowania z cache |
| --- | ---: | ---: | ---: |
| 135M | 134 515 008 | 269,0 MB | 777,4 ms |
| 360M | 361 821 120 | 723,6 MB | 592,5 ms |

Wszystkie inferencje zakończyły się bez wyjątków. W dodatkowym teście CPU oba modele rozwiązały planszę `medium-01` z rzeczywistymi wywołaniami LLM. Pełne dane z każdego uruchomienia są w [wynikach MPS](benchmark/results.json) i [teście CPU](benchmark/cpu-smoke.json). [Zestaw plansz](benchmark/puzzles.json)

### Wnioski

1. **Model 135M ograniczył liczbę cofnięć na tym zbiorze.** Względem klasycznego MRV wykonał o 42 cofnięcia mniej (4,6%). Poprawił wynik na 6 planszach, pogorszył na jednej, a na 23 uzyskał tyle samo cofnięć. Model 360M miał o 120 cofnięć więcej (13,1%) łącznie. Na samych trudnych planszach obie hybrydy ograniczyły cofnięcia, z 755 do 699 dla 135M i do 618 dla 360M.
2. **135M uzyskał tę samą poprawność co 360M przy mniejszym koszcie.** Wykonał mniej cofnięć w całym zbiorze, a jego wagi zajmowały około 63% mniej pamięci. Mediana czasu na planszę była mniej więcej o połowę krótsza. Na trudnych planszach 360M wykonał mniej cofnięć niż 135M.
3. **Klasyczny MRV był najszybszy.** Narzut inferencji przewyższył oszczędność prób nawet w wariancie 135M. Wyniki opisują jeden syntetyczny zestaw, konkretny prompt i jeden pomiar na planszę. Skuteczność doboru cyfr na innych zestawach i stabilność pomiarów czasu wymagają osobnego sprawdzenia.

### Powtórzenie pomiarów i testów

W aktywowanym środowisku Pythona:

```sh
python backend/benchmark.py --device auto --output benchmark/results.local.json
python backend/benchmark.py --device cpu --difficulty medium --limit 1 --output benchmark/cpu.local.json
python -m unittest discover -s backend -v
```

Z działającym backendem uruchom test integracyjny, testy renderowania Reacta i kompilację:

```sh
cd sudoku-llm-frontend
SUDOKU_TEST_ENDPOINT=http://localhost:8000/api/solve-sudoku npm test
npm run build
```
