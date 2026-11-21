require "rails_helper"

RSpec.describe Importer::Parsing do
  def invalid(method, input)
    expect { described_class.public_send(method, input) }.to raise_error(described_class::Invalid)
  end

  describe ".money_to_cents" do
    it("parses 299.50") { expect(described_class.money_to_cents("299.50")).to eq(29_950) }
    it("parses whole dollars") { expect(described_class.money_to_cents("150")).to eq(15_000) }
    it("parses one decimal") { expect(described_class.money_to_cents("0.5")).to eq(50) }
    it("parses zero") { expect(described_class.money_to_cents("0.00")).to eq(0) }
    it("rejects exponent") { invalid(:money_to_cents, "1e3") }
    it("rejects NaN") { invalid(:money_to_cents, "NaN") }
    it("rejects three decimals") { invalid(:money_to_cents, "1.234") }
    it("rejects negatives") { invalid(:money_to_cents, "-1.00") }
    it("rejects whitespace") { invalid(:money_to_cents, " 1.00") }
    it("rejects blank") { invalid(:money_to_cents, "") }
    it("rejects nil") { invalid(:money_to_cents, nil) }
    it("rejects a trailing dot") { invalid(:money_to_cents, "1.") }
    it("rejects out-of-range amounts") { invalid(:money_to_cents, "21474837.00") }
    it("accepts the largest in-range amount") { expect(described_class.money_to_cents("21474836.47")).to eq(2_147_483_647) }
  end

  describe ".integer" do
    it("parses digits") { expect(described_class.integer("42")).to eq(42) }
    it("parses leading zeros as decimal") { expect(described_class.integer("010")).to eq(10) }
    it("accepts the maximum") { expect(described_class.integer("2147483647")).to eq(2_147_483_647) }
    it("rejects above the maximum") { invalid(:integer, "2147483648") }
    it("rejects underscores") { invalid(:integer, "1_0") }
    it("rejects signs") { invalid(:integer, "+1") }
    it("rejects negatives") { invalid(:integer, "-1") }
    it("rejects spaces") { invalid(:integer, "1 ") }
    it("rejects decimals") { invalid(:integer, "1.0") }
    it("rejects blank") { invalid(:integer, "") }
  end

  describe ".timestamp" do
    it "parses ISO-8601 UTC" do
      t = described_class.timestamp("2025-09-01T12:30:45Z")
      expect(t).to eq(Time.utc(2025, 9, 1, 12, 30, 45))
      expect(t.utc?).to be(true)
    end

    it("accepts fractional seconds") { expect(described_class.timestamp("2025-09-01T12:30:45.5Z").usec).to eq(500_000) }
    it("rejects +00:00 offsets") { invalid(:timestamp, "2025-09-01T12:30:45+00:00") }
    it("rejects other offsets") { invalid(:timestamp, "2025-09-01T12:30:45-05:00") }
    it("rejects a missing zone") { invalid(:timestamp, "2025-09-01T12:30:45") }
    it("rejects date only") { invalid(:timestamp, "2025-09-01") }
    it("rejects impossible dates") { invalid(:timestamp, "2025-13-45T12:30:45Z") }
    it("rejects blank") { invalid(:timestamp, "") }
  end

  describe ".boolean" do
    it("parses true") { expect(described_class.boolean("true")).to be(true) }
    it("parses false") { expect(described_class.boolean("false")).to be(false) }
    it("rejects True") { invalid(:boolean, "True") }
    it("rejects 1") { invalid(:boolean, "1") }
    it("rejects blank") { invalid(:boolean, "") }
  end

  it "uses the reason as the error message" do
    expect { described_class.integer("x") }.to raise_error(described_class::Invalid, /invalid integer/)
  end
end
