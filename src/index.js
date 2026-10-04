// Bundle entry: every card folder registers itself on import.
import.meta.glob("./cards/*/index.js", { eager: true });
