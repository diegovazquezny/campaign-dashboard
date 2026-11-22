module Metrics
  # One call for GET /api/calls/:id: the list row plus facts about its caller.
  # Never selects caller_number_hash into the result; the hash only appears
  # inside the subqueries.
  module CallDetail
    module_function

    # Raises ActiveRecord::RecordNotFound for an unknown id.
    def call(id:)
      call = CallList.with_names(Call.where(call_id: id))
                     .select(caller_facts_sql)
                     .take or raise ActiveRecord::RecordNotFound

      CallList.row(call).merge(
        is_first_call: call.is_first_call,
        caller_call_count: call.caller_call_count,
        caller_first_seen: call.caller_first_seen.iso8601
      )
    end

    # `is_first_call` is the shared `new_callers` probe, so it agrees with the
    # metrics. The first call is ordered by (started_at, call_id), like the probe.
    def caller_facts_sql
      same_caller = "k.caller_number_hash = calls.caller_number_hash"
      <<~SQL.squish
        (#{EarlierCallProbe.no_earlier_call_sql('calls')}) AS is_first_call,
        (SELECT COUNT(*) FROM calls k WHERE #{same_caller}) AS caller_call_count,
        (SELECT k.local_date FROM calls k WHERE #{same_caller} ORDER BY k.started_at, k.call_id LIMIT 1) AS caller_first_seen
      SQL
    end
  end
end
