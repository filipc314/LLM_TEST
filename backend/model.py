import os
from functools import lru_cache


MODEL_IDS = {
    "smollm2-135m": "HuggingFaceTB/SmolLM2-135M-Instruct",
    "smollm2-360m": "HuggingFaceTB/SmolLM2-360M-Instruct",
}
MODEL_REVISIONS = {
    "smollm2-135m": "12fd25f77366fa6b3b4b768ec3050bf629380bac",
    "smollm2-360m": "a10cc1512eabd3dde888204e902eca88bddb4951",
}


class ModelUnavailable(RuntimeError):
    """The requested model could not be initialized."""


def build_messages(board, row, col, candidates):
    grid = "\n".join(" ".join(str(value) if value else "." for value in line) for line in board)
    digits = ", ".join(map(str, candidates))
    return [
        {"role": "system", "content": (
            "You are guiding a Sudoku solver. Choose the candidate most likely to lead "
            "to a complete solution. Reply with exactly one digit."
        )},
        {"role": "user", "content": (
            f"Sudoku grid (. is empty):\n{grid}\n"
            f"Target: row {row + 1}, column {col + 1}. Candidates: {digits}.\n"
            "Reply with one candidate digit."
        )},
        {"role": "assistant", "content": "Answer:"},
    ]


def parse_choice(text, candidates):
    digit = text.strip()
    if len(digit) == 1 and digit in "123456789" and int(digit) in candidates:
        return int(digit)
    return None


class LocalModel:
    def __init__(self, tokenizer, model, torch, device):
        self.tokenizer = tokenizer
        self.model = model
        self.torch = torch
        self.device = device

    def __call__(self, board, row, col, candidates):
        inputs = self.tokenizer.apply_chat_template(
            build_messages(board, row, col, candidates),
            continue_final_message=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self.device)
        with self.torch.inference_mode():
            tokens = self.model.generate(
                **inputs, max_new_tokens=3, do_sample=False, use_cache=True,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        answer = self.tokenizer.decode(tokens[0, inputs.input_ids.shape[-1]:],
                                       skip_special_tokens=True)
        return parse_choice(answer, candidates)


def load_model(name, device=None):
    return _load_model(name, device or os.getenv("SUDOKU_DEVICE", "auto"))


@lru_cache(maxsize=len(MODEL_IDS))
def _load_model(name, device):
    if name not in MODEL_IDS:
        raise ValueError(f"Unknown model: {name}")

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        if device == "auto":
            device = "mps" if torch.backends.mps.is_available() else "cpu"
        if device not in {"mps", "cpu"}:
            raise ValueError("SUDOKU_DEVICE must be auto, mps, or cpu.")
        if device == "mps" and not torch.backends.mps.is_available():
            raise RuntimeError("PyTorch MPS is unavailable. Set SUDOKU_DEVICE=cpu.")
        if device == "cpu":
            torch.set_num_threads(min(4, torch.get_num_threads()))
        dtype = torch.float16 if device == "mps" else torch.float32
        repository = MODEL_IDS[name]
        revision = MODEL_REVISIONS[name]
        tokenizer = AutoTokenizer.from_pretrained(repository, revision=revision)
        model = AutoModelForCausalLM.from_pretrained(
            repository, revision=revision, dtype=dtype, use_safetensors=True,
        )
        model.to(device).eval()
        if device == "mps":
            torch.mps.synchronize()
        return LocalModel(tokenizer, model, torch, device)
    except (ImportError, OSError, RuntimeError, ValueError) as error:
        raise ModelUnavailable(f"Could not load {name}: {error}") from error
