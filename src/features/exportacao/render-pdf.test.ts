import { describe, expect, it } from "vitest";
import { compativelComFonte } from "./render-pdf";

describe("texto compatível com a fonte do PDF", () => {
  it("troca setas e remove emojis", () => {
    expect(compativelComFonte("Sala → Banheiro → Parque ✅ 🎨")).toBe("Sala -> Banheiro -> Parque  ");
    expect(compativelComFonte("Educação – 7h30 • ótimo")).toBe("Educação – 7h30 • ótimo");
  });
});
