import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { ProductReviewPage } from "../ProductReviewPage";
import type { CatalogProduct } from "@/types/catalog";

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "prod-1",
    product_name: "工业LED投光灯",
    model_number: "LED-FL-100W",
    unit_price_rmb: 45,
    moq: 50,
    weight_kg: 1.2,
    dimensions: "30x20x15cm",
    material: "Aluminum",
    category: "Industrial Lighting",
    hs_code: null,
    supplier_id: "sup-1",
    supplier_name: "Guangzhou Factory",
    factory_name: "Guangzhou Factory",
    location_in_china: "Guangzhou",
    document_id: "doc-1",
    document_file_name: "catalogue.pdf",
    extracted_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockPendingList(items: CatalogProduct[], totalPages = 1) {
  server.use(
    http.get("*/catalog/products/pending", () =>
      HttpResponse.json({ items, total: items.length, page: 1, page_size: 30, total_pages: totalPages }),
    ),
  );
}

describe("ProductReviewPage", () => {
  it("shows the empty state when there are no pending products", async () => {
    mockPendingList([]);
    renderWithProviders(<ProductReviewPage />);

    expect(await screen.findByText("لا توجد منتجات تنتظر المراجعة")).toBeInTheDocument();
  });

  it("shows an error message with a retry button when the fetch fails", async () => {
    server.use(
      http.get("*/catalog/products/pending", () => HttpResponse.error()),
    );
    renderWithProviders(<ProductReviewPage />);

    expect(
      await screen.findByText("تعذّر تحميل المنتجات قيد المراجعة"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeInTheDocument();
  });

  it("lists pending products with their key fields", async () => {
    mockPendingList([makeProduct()]);
    renderWithProviders(<ProductReviewPage />);

    expect(await screen.findByText("工业LED投光灯")).toBeInTheDocument();
    expect(screen.getByText("LED-FL-100W")).toBeInTheDocument();
    expect(screen.getByText("MOQ: 50")).toBeInTheDocument();
  });

  it("approving a product PATCHes the approve action and refreshes the list", async () => {
    mockPendingList([makeProduct()]);
    let capturedBody: unknown;
    server.use(
      http.patch("*/catalog/products/:id/review", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(makeProduct());
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ProductReviewPage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "قبول" }));

    await waitFor(() => {
      expect(capturedBody).toEqual({ action: "approve" });
    });
  });

  it("rejecting a product PATCHes the reject action", async () => {
    mockPendingList([makeProduct()]);
    let capturedBody: unknown;
    server.use(
      http.patch("*/catalog/products/:id/review", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(makeProduct());
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ProductReviewPage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "رفض" }));

    await waitFor(() => {
      expect(capturedBody).toEqual({ action: "reject" });
    });
  });

  it("editing fields before approving sends the edited values", async () => {
    mockPendingList([makeProduct()]);
    let capturedBody: any;
    server.use(
      http.patch("*/catalog/products/:id/review", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(makeProduct({ unit_price_rmb: 99.5 }));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ProductReviewPage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "تعديل" }));
    const priceInput = screen.getByDisplayValue("45");
    await user.clear(priceInput);
    await user.type(priceInput, "99.5");
    await user.click(screen.getByRole("button", { name: "حفظ وقبول" }));

    await waitFor(() => {
      expect(capturedBody).toMatchObject({ action: "approve", unit_price_rmb: 99.5 });
    });
  });

  it("shows a non-canonical category in the free-text 'other' field when editing", async () => {
    mockPendingList([makeProduct({ category: "Industrial Lighting" })]);
    const user = userEvent.setup();
    renderWithProviders(<ProductReviewPage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "تعديل" }));

    expect(screen.getByDisplayValue("Industrial Lighting")).toBeInTheDocument();
  });

  it("selecting a canonical category and approving sends its value", async () => {
    mockPendingList([makeProduct({ category: null })]);
    let capturedBody: any;
    server.use(
      http.patch("*/catalog/products/:id/review", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(makeProduct({ category: "electronics" }));
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<ProductReviewPage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "تعديل" }));
    const categorySelect = screen.getByDisplayValue("—");
    await user.selectOptions(categorySelect, "electronics");
    await user.click(screen.getByRole("button", { name: "حفظ وقبول" }));

    await waitFor(() => {
      expect(capturedBody).toMatchObject({ action: "approve", category: "electronics" });
    });
  });

  it("expanding a card reveals additional details (weight, dimensions, source document)", async () => {
    mockPendingList([makeProduct()]);
    const user = userEvent.setup();
    renderWithProviders(<ProductReviewPage />);
    await screen.findByText("工业LED投光灯");

    const expandButtons = screen.getAllByRole("button").filter(
      (b) => !b.textContent?.trim(),
    );
    await user.click(expandButtons[expandButtons.length - 1]);

    expect(await screen.findByText("30x20x15cm")).toBeInTheDocument();
    expect(screen.getByText("catalogue.pdf")).toBeInTheDocument();
  });
});
