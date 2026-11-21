require "bigdecimal"
require "date"
require "time"

module Importer
  # Strict string parsers shared by the importer. Each returns the parsed value
  # or raises Importer::Parsing::Invalid, whose message is the rejection reason.
  module Parsing
    class Invalid < StandardError; end

    MAX_INTEGER = 2_147_483_647 # 4-byte Postgres integer
    MONEY_RE = /\A\d+(\.\d{1,2})?\z/
    INTEGER_RE = /\A\d+\z/
    TIMESTAMP_RE = /\A(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?Z\z/

    module_function

    # "299.50" -> 29950. No signs, exponents, whitespace or fractional cents.
    def money_to_cents(str)
      raise Invalid, "invalid amount #{str.inspect}" unless str.is_a?(String) && MONEY_RE.match?(str)

      cents = (BigDecimal(str) * 100).to_i
      raise Invalid, "amount out of range #{str.inspect}" if cents > MAX_INTEGER

      cents
    end

    # Digits only, within a 4-byte Postgres integer.
    def integer(str)
      raise Invalid, "invalid integer #{str.inspect}" unless str.is_a?(String) && INTEGER_RE.match?(str)

      value = Integer(str, 10)
      raise Invalid, "integer out of range #{str.inspect}" if value > MAX_INTEGER

      value
    end

    # ISO-8601 UTC only (must end in "Z"); returns a UTC Time. Components are
    # range-checked because Time.iso8601 rolls impossible values over
    # (2025-02-30 -> Mar 2, T24:00:00 -> next day, :60 -> next minute).
    def timestamp(str)
      match = str.is_a?(String) && TIMESTAMP_RE.match(str)
      raise Invalid, "invalid timestamp #{str.inspect}" unless match

      year, month, day, hour, min, sec = match.captures.first(6).map { |part| Integer(part, 10) }
      valid = Date.valid_date?(year, month, day) && hour <= 23 && min <= 59 && sec <= 59
      raise Invalid, "invalid timestamp #{str.inspect}" unless valid

      Time.iso8601(str).utc
    rescue ArgumentError
      raise Invalid, "invalid timestamp #{str.inspect}"
    end

    # Exactly "true" or "false".
    def boolean(str)
      case str
      when "true" then true
      when "false" then false
      else raise Invalid, "invalid boolean #{str.inspect}"
      end
    end
  end
end
