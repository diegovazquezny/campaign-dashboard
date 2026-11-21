require "rails_helper"

RSpec.describe Metrics::SpendSql do
  def select_value(sql)
    ActiveRecord::Base.connection.select_value("SELECT #{sql}")
  end

  def sql_covered_days(from:, to:, cov_from:, cov_to:)
    select_value(described_class.covered_days(from:, to:, cov_from:, cov_to:))
  end

  def budget_literal(budget)
    budget.nil? ? "NULL::int" : budget
  end

  def sql_total(budget:, covered_days:, filtered:, office_calls: 0, campaign_calls: 0)
    ActiveRecord::Base.connection.select_value(<<~SQL)
      SELECT #{described_class.total_cents(filtered:)}
      FROM (VALUES (#{budget_literal(budget)}, #{covered_days}, #{office_calls}, #{campaign_calls}))
        AS t(daily_budget_cents, covered_days, office_calls, campaign_calls)
    SQL
  end

  def sql_daily(budget:, covered_day:, covered_through:, filtered:, office_calls: 0, campaign_calls: 0)
    ActiveRecord::Base.connection.select_value(<<~SQL)
      SELECT #{described_class.daily_cents(filtered:)}
      FROM (VALUES (#{budget_literal(budget)}, #{office_calls}, #{campaign_calls}, #{covered_day}, #{covered_through}))
        AS t(daily_budget_cents, office_calls, campaign_calls, covered_day, covered_through)
    SQL
  end

  describe ".covered_days" do
    let(:cov) { { cov_from: Date.new(2026, 9, 1), cov_to: Date.new(2026, 9, 30) } }

    it "counts a range inside coverage" do
      expect(sql_covered_days(from: Date.new(2026, 9, 5), to: Date.new(2026, 9, 14), **cov)).to eq(10)
    end

    it "clips a range starting before coverage" do
      expect(sql_covered_days(from: Date.new(2026, 8, 20), to: Date.new(2026, 9, 10), **cov)).to eq(10)
    end

    it "clips a range ending after coverage" do
      expect(sql_covered_days(from: Date.new(2026, 9, 25), to: Date.new(2026, 10, 20), **cov)).to eq(6)
    end

    it "is 0 when disjoint on either side" do
      expect(sql_covered_days(from: Date.new(2026, 7, 1), to: Date.new(2026, 8, 31), **cov)).to eq(0)
      expect(sql_covered_days(from: Date.new(2026, 10, 1), to: Date.new(2026, 10, 5), **cov)).to eq(0)
    end

    it "is 1 for a single day" do
      expect(sql_covered_days(from: Date.new(2026, 9, 30), to: Date.new(2026, 9, 30), **cov)).to eq(1)
    end

    it "is 0 when coverage is nil" do
      expect(sql_covered_days(from: Date.new(2026, 9, 1), to: Date.new(2026, 9, 30), cov_from: nil, cov_to: nil)).to eq(0)
    end

    it "accepts SQL expressions" do
      sql = described_class.covered_days(from: "DATE '2026-09-01'", to: "DATE '2026-09-10'",
                                         cov_from: "DATE '2026-09-06'", cov_to: "DATE '2026-12-01'")
      expect(select_value(sql)).to eq(5)
    end
  end

  describe ".total_cents" do
    it "is NULL for a $0 budget or no campaign, with or without a filter" do
      [ 0, nil ].each do |budget|
        expect(sql_total(budget:, covered_days: 30, filtered: false)).to be_nil
        expect(sql_total(budget:, covered_days: 30, filtered: true, office_calls: 1, campaign_calls: 2)).to be_nil
      end
    end

    it "is budget x covered days without a filter, and 0 (not NULL) with no covered days" do
      expect(sql_total(budget: 1500, covered_days: 30, filtered: false)).to eq(45_000)
      expect(sql_total(budget: 1500, covered_days: 0, filtered: false)).to eq(0)
    end

    it "is NULL with a filter when the campaign has no calls in range" do
      expect(sql_total(budget: 1500, covered_days: 30, filtered: true)).to be_nil
    end

    it "is 0 with a filter when no calls are at the office" do
      expect(sql_total(budget: 1500, covered_days: 30, filtered: true, office_calls: 0, campaign_calls: 4)).to eq(0)
    end

    it "is 0 (not NULL) for a paid campaign with zero covered days" do
      expect(sql_total(budget: 1500, covered_days: 0, filtered: true, office_calls: 1, campaign_calls: 4)).to eq(0)
    end

    it "rounds an exact half cent away from zero" do
      # 1 * 1 * 1 / 2 = 0.5 -> 1;  3 * 5 * 1 / 2 = 7.5 -> 8
      expect(sql_total(budget: 1, covered_days: 1, filtered: true, office_calls: 1, campaign_calls: 2)).to eq(1)
      expect(sql_total(budget: 5, covered_days: 1, filtered: true, office_calls: 3, campaign_calls: 2)).to eq(8)
    end

    it "returns an Integer" do
      expect(sql_total(budget: 1500, covered_days: 30, filtered: false)).to be_a(Integer)
    end
  end

  describe ".daily_cents" do
    it "is NULL for $0 budget, the budget on covered days and 0 elsewhere without a filter" do
      expect(sql_daily(budget: 0, covered_day: true, covered_through: 1, filtered: false)).to be_nil
      expect(sql_daily(budget: 700, covered_day: true, covered_through: 3, filtered: false)).to eq(700)
      expect(sql_daily(budget: 700, covered_day: false, covered_through: 0, filtered: false)).to eq(0)
    end

    it "is NULL with a filter when the campaign has no calls, and 0 off coverage" do
      expect(sql_daily(budget: 700, covered_day: true, covered_through: 1, filtered: true)).to be_nil
      expect(sql_daily(budget: 700, covered_day: false, covered_through: 5, filtered: true,
                       office_calls: 1, campaign_calls: 3)).to eq(0)
    end

    it "sums to the total for a 1/3 share over four weeks, within half a cent of exact" do
      budget = 1001
      days = 28
      daily = (1..days).map do |k|
        sql_daily(budget:, covered_day: true, covered_through: k, filtered: true, office_calls: 1, campaign_calls: 3)
      end
      total = sql_total(budget:, covered_days: days, filtered: true, office_calls: 1, campaign_calls: 3)

      expect(daily.sum).to eq(total)
      expect((total - Rational(budget * days, 3)).abs).to be <= Rational(1, 2)
      # rounding each day alone would repeat a 1/3 cent error 28 times
      expect(Rational(budget, 3).round * days).not_to eq(total)
    end
  end

  describe "against the Rational oracle" do
    def check_total(budget:, covered_days:, filtered:, office_calls:, campaign_calls:)
      args = { budget:, covered_days:, filtered:, office_calls:, campaign_calls: }
      expect(sql_total(**args)).to eq(SpendOracle.total_cents(**args)), "total_cents mismatch for #{args}"
    end

    it "matches over a table of cases" do
      [
        [ 0, 10, 1, 2 ], [ 1, 1, 1, 2 ], [ 999, 31, 1, 3 ], [ 2500, 0, 3, 7 ],
        [ 12_345, 366, 7, 7 ], [ 12_345, 366, 0, 7 ], [ 333, 29, 2, 3 ], [ 5, 1, 3, 2 ]
      ].each do |budget, days, office, campaign|
        [ true, false ].each do |filtered|
          check_total(budget:, covered_days: days, filtered:, office_calls: office, campaign_calls: campaign)
        end
      end
    end

    it "matches over a randomized batch (fixed seed), including daily sums" do
      rng = Random.new(20_260_921)
      60.times do
        budget = rng.rand(0..50_000)
        days = rng.rand(0..45)
        campaign = rng.rand(1..40)
        office = rng.rand(0..campaign)
        check_total(budget:, covered_days: days, filtered: true, office_calls: office, campaign_calls: campaign)
        check_total(budget:, covered_days: days, filtered: false, office_calls: office, campaign_calls: campaign)

        next if days.zero? || budget.zero?

        daily = (1..days).map do |k|
          args = { budget:, covered_day: true, covered_through: k, filtered: true,
                   office_calls: office, campaign_calls: campaign }
          value = sql_daily(**args)
          expect(value).to eq(SpendOracle.daily_cents(**args))
          value
        end
        expected_total = SpendOracle.total_cents(budget:, covered_days: days, filtered: true,
                                                 office_calls: office, campaign_calls: campaign)
        expect(daily.sum).to eq(expected_total)
      end
    end

    it "matches covered_days over random ranges" do
      rng = Random.new(7)
      base = Date.new(2026, 9, 1)
      100.times do
        from = base + rng.rand(-30..60)
        to = from + rng.rand(0..60)
        cov_from = base + rng.rand(0..20)
        cov_to = cov_from + rng.rand(0..40)
        args = { from:, to:, cov_from:, cov_to: }
        expect(sql_covered_days(**args)).to eq(SpendOracle.covered_days(**args))
      end
    end
  end
end
