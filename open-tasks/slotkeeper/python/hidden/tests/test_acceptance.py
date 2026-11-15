"""Hidden acceptance tests for SlotKeeper. They use only the documented interface."""

import unittest

from slotkeeper import (
    ConflictError,
    DailyLimitError,
    NotFoundError,
    SlotKeeper,
    SlotUnavailableError,
    TooSoonError,
    ValidationError,
)

MON, TUE, WED, SAT, SUN, NEXT_MON, NEXT_SAT = 7, 8, 9, 12, 13, 14, 19
MORNING = [(0, 540, 720)]          # Mondays 09:00-12:00
INTRO = ("intro", 30, {})


def at(day, hour, minute=0):
    return day * 1440 + hour * 60 + minute


def make(windows, *types):
    """A SlotKeeper with host "ana" and the given (type_id, duration, options) meeting types."""
    keeper = SlotKeeper()
    keeper.add_host("ana", list(windows))
    for type_id, duration, options in types:
        keeper.add_meeting_type("ana", type_id, duration, **options)
    return keeper


def every_15(first, count):
    return [first + 15 * i for i in range(count)]


# ---------------------------------------------------------------------------
# Part 1 · Core
# ---------------------------------------------------------------------------

class SetupTests(unittest.TestCase):
    def test_host_validation(self):
        keeper = SlotKeeper()
        keeper.add_host("ana", [])
        with self.assertRaises(ValidationError):
            keeper.add_host("ana", [(0, 540, 600)])
        for window in [(7, 540, 600), (-1, 540, 600), (0, 600, 600), (0, 660, 600), (0, -15, 600), (0, 540, 1441)]:
            with self.subTest(window=window):
                keeper = SlotKeeper()
                with self.assertRaises(ValidationError):
                    keeper.add_host("bo", [(0, 540, 600), window])
                # The failed call registered nothing, and a window may end at 24:00.
                keeper.add_host("bo", [(6, 1380, 1440)])

    def test_meeting_type_validation(self):
        keeper = SlotKeeper()
        keeper.add_host("ana", MORNING)
        keeper.add_host("bo", MORNING)
        with self.assertRaises(NotFoundError):
            keeper.add_meeting_type("ghost", "x", 30)
        keeper.add_meeting_type("ana", "intro", 30)
        with self.assertRaises(ValidationError):
            keeper.add_meeting_type("ana", "intro", 45)
        with self.assertRaises(ValidationError, msg="type ids are unique across hosts"):
            keeper.add_meeting_type("bo", "intro", 30)
        bad = [(0, {}), (1441, {}), (30, {"buffer_before": -5}), (30, {"buffer_after": -1}), (30, {"min_notice": -1})]
        for duration, options in bad:
            with self.subTest(duration=duration, **options):
                with self.assertRaises(ValidationError):
                    keeper.add_meeting_type("ana", "bad", duration, **options)
        keeper.add_meeting_type("ana", "bad", 1440)

    def test_unknown_ids_and_reversed_ranges(self):
        keeper = make(MORNING, INTRO)
        with self.assertRaises(NotFoundError):
            keeper.list_slots("nope", MON, MON, 0)
        with self.assertRaises(NotFoundError):
            keeper.book("nope", at(MON, 9), "sam", 0)
        with self.assertRaises(NotFoundError):
            keeper.get_booking(1)
        with self.assertRaises(NotFoundError):
            keeper.list_bookings("ghost")
        with self.assertRaises(ValidationError):
            keeper.list_slots("intro", TUE, MON, 0)
        self.assertEqual(keeper.list_bookings("ana"), [])


class SlotListingTests(unittest.TestCase):
    def test_slots_fit_inside_windows(self):
        keeper = SlotKeeper()
        keeper.add_host("ana", [(0, 540, 600)])      # 09:00-10:00
        keeper.add_meeting_type("ana", "long", 45)
        keeper.add_host("bo", [(0, 550, 620)])       # 09:10-10:20, off the grid
        keeper.add_meeting_type("bo", "chat", 30)
        self.assertEqual(keeper.list_slots("long", MON, MON, 0), [at(MON, 9), at(MON, 9, 15)])
        self.assertEqual(keeper.list_slots("chat", MON, MON, 0), [at(MON, 9, 15), at(MON, 9, 30), at(MON, 9, 45)])

    def test_touching_and_overlapping_windows_merge(self):
        keeper = SlotKeeper()
        keeper.add_host("ana", [(0, 600, 660), (0, 540, 600)])    # touching, out of order
        keeper.add_host("bo", [(0, 540, 620), (0, 600, 660)])     # overlapping
        keeper.add_meeting_type("ana", "hour", 60)
        keeper.add_meeting_type("bo", "bo-hour", 60)
        expected = every_15(at(MON, 9), 5)
        self.assertEqual(keeper.list_slots("hour", MON, MON, 0), expected)
        self.assertEqual(keeper.list_slots("bo-hour", MON, MON, 0), expected)

    def test_meetings_never_cross_midnight(self):
        keeper = make([(0, 1380, 1440), (1, 0, 60)], ("hour", 60, {}))
        self.assertEqual(keeper.list_slots("hour", MON, TUE, 0), [at(MON, 23), at(TUE, 0)])
        with self.assertRaises(SlotUnavailableError):
            keeper.book("hour", at(MON, 23, 30), "sam", 0)
        self.assertEqual(keeper.book("hour", at(MON, 23), "sam", 0), 1)

    def test_weekday_comes_from_the_day_index(self):
        keeper = make([(5, 600, 630), (6, 600, 630)], INTRO)    # Saturdays and Sundays 10:00-10:30
        self.assertEqual(keeper.list_slots("intro", 0, 13, 0), [at(5, 10), at(6, 10), at(SAT, 10), at(SUN, 10)])

    def test_slots_respect_notice_and_now(self):
        keeper = make(MORNING, ("advance", 30, {"min_notice": 120}), INTRO)
        self.assertEqual(keeper.list_slots("advance", MON, MON, at(MON, 8)), every_15(at(MON, 10), 7))
        slots = keeper.list_slots("intro", MON, MON, at(MON, 9, 7))
        self.assertEqual(slots, every_15(at(MON, 9, 15), 10))
        self.assertEqual(
            keeper.list_slots("intro", 0, NEXT_MON, at(MON, 11, 30)),
            [at(MON, 11, 30)] + every_15(at(NEXT_MON, 9), 11),
        )


class BookingRuleTests(unittest.TestCase):
    def test_min_notice_is_inclusive_and_the_past_is_too_soon(self):
        keeper = make(MORNING, ("advance", 30, {"min_notice": 120}), INTRO)
        with self.assertRaises(TooSoonError):
            keeper.book("advance", at(MON, 9, 45), "sam", at(MON, 8))
        self.assertEqual(keeper.book("advance", at(MON, 10), "sam", at(MON, 8)), 1)
        with self.assertRaises(TooSoonError):
            keeper.book("intro", at(MON, 10, 45), "kim", at(MON, 11))
        self.assertEqual(keeper.book("intro", at(MON, 11), "kim", at(MON, 11)), 2)

    def test_bookings_must_fit_availability(self):
        keeper = make([(0, 540, 600)], INTRO)
        for start in (at(TUE, 9), at(MON, 8, 45), at(MON, 9, 45), at(MON, 10)):
            with self.subTest(start=start):
                with self.assertRaises(SlotUnavailableError):
                    keeper.book("intro", start, "sam", 0)
        self.assertEqual(keeper.list_bookings("ana"), [])

    def test_overlaps_conflict_but_back_to_back_is_fine(self):
        keeper = make([(0, 540, 660)], INTRO)
        keeper.book("intro", at(MON, 9, 30), "sam", 0)
        for start in (at(MON, 9, 15), at(MON, 9, 30), at(MON, 9, 45)):
            with self.subTest(start=start):
                with self.assertRaises(ConflictError):
                    keeper.book("intro", start, "kim", 0)
        self.assertEqual(keeper.book("intro", at(MON, 9), "kim", 0), 2, "failed attempts must not use up ids")
        self.assertEqual(keeper.book("intro", at(MON, 10), "lee", 0), 3)

    def test_conflicts_span_meeting_types_but_not_hosts(self):
        keeper = make([(0, 540, 660)], INTRO, ("deep", 60, {}))
        keeper.add_host("bo", [(0, 540, 660)])
        keeper.add_meeting_type("bo", "bo-intro", 30)
        keeper.book("deep", at(MON, 9), "sam", 0)
        with self.assertRaises(ConflictError):
            keeper.book("intro", at(MON, 9, 30), "kim", 0)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), [at(MON, 10), at(MON, 10, 15), at(MON, 10, 30)])
        self.assertEqual(keeper.book("bo-intro", at(MON, 9, 30), "kim", 0), 2)

    def test_checks_run_in_the_documented_order(self):
        keeper = make([(0, 540, 600)], INTRO)
        with self.assertRaises(NotFoundError):
            keeper.book("nope", at(MON, 9, 10), "sam", 0)
        with self.assertRaises(ValidationError):
            keeper.book("intro", at(MON, 9, 10), "sam", 0)
        with self.assertRaises(ValidationError, msg="off-grid is reported before too soon"):
            keeper.book("intro", at(MON, 8, 5), "sam", at(MON, 12))
        with self.assertRaises(TooSoonError, msg="too soon is reported before unavailable"):
            keeper.book("intro", at(MON, 8), "sam", at(MON, 12))
        keeper.book("intro", at(MON, 9, 30), "sam", 0)
        with self.assertRaises(SlotUnavailableError, msg="unavailable is reported before conflict"):
            keeper.book("intro", at(MON, 9, 45), "kim", 0)


# ---------------------------------------------------------------------------
# Part 2 · Buffers, changes and limits
# ---------------------------------------------------------------------------

class BufferTests(unittest.TestCase):
    def test_after_buffer_blocks_the_following_slot(self):
        keeper = make(MORNING, ("padded", 30, {"buffer_after": 15}), INTRO)
        keeper.book("padded", at(MON, 9), "sam", 0)
        with self.assertRaises(ConflictError):
            keeper.book("intro", at(MON, 9, 30), "kim", 0)
        self.assertEqual(keeper.book("intro", at(MON, 9, 45), "kim", 0), 2)

    def test_before_buffers_protect_both_sides(self):
        keeper = make(MORNING, ("prep", 30, {"buffer_before": 30}), INTRO)
        keeper.book("intro", at(MON, 9), "sam", 0)                     # 09:00-09:30
        with self.assertRaises(ConflictError):
            keeper.book("prep", at(MON, 9, 45), "kim", 0)              # its buffer starts 09:15
        self.assertEqual(keeper.book("prep", at(MON, 10, 30), "kim", 0), 2)   # blocks 10:00-10:30
        with self.assertRaises(ConflictError):
            keeper.book("intro", at(MON, 10), "lee", 0)
        self.assertEqual(keeper.book("intro", at(MON, 9, 30), "lee", 0), 3)

    def test_buffers_do_not_stack(self):
        keeper = make(MORNING, ("tail", 30, {"buffer_after": 15}), ("head", 30, {"buffer_before": 15}))
        keeper.book("tail", at(MON, 9), "sam", 0)
        with self.assertRaises(ConflictError):
            keeper.book("head", at(MON, 9, 30), "kim", 0)
        self.assertEqual(keeper.book("head", at(MON, 9, 45), "kim", 0), 2, "the gap is max(15, 15), not 15 + 15")

    def test_buffers_may_extend_outside_availability(self):
        keeper = make([(0, 540, 600)], ("padded", 30, {"buffer_before": 15, "buffer_after": 15}))
        self.assertEqual(keeper.list_slots("padded", MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)])
        self.assertEqual(keeper.book("padded", at(MON, 9), "sam", 0), 1)

    def test_slot_list_reflects_buffers_on_both_sides(self):
        keeper = make(MORNING, ("padded", 30, {"buffer_after": 15}))
        keeper.book("padded", at(MON, 10), "sam", 0)                  # 10:00-10:30, blocked until 10:45
        self.assertEqual(
            keeper.list_slots("padded", MON, MON, 0),
            [at(MON, 9), at(MON, 9, 15), at(MON, 10, 45), at(MON, 11), at(MON, 11, 15), at(MON, 11, 30)],
        )


class CancelTests(unittest.TestCase):
    def test_cancel_frees_the_time(self):
        keeper = make([(0, 540, 600)], INTRO)
        keeper.book("intro", at(MON, 9), "sam", 0)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), [at(MON, 9, 30)])
        keeper.cancel(1)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)])
        self.assertEqual(keeper.list_bookings("ana"), [])
        with self.assertRaises(NotFoundError):
            keeper.get_booking(1)

    def test_cancel_errors_and_ids_are_never_reused(self):
        keeper = make([(0, 540, 600)], INTRO)
        with self.assertRaises(NotFoundError):
            keeper.cancel(1)
        keeper.book("intro", at(MON, 9), "sam", 0)
        keeper.cancel(1)
        with self.assertRaises(NotFoundError):
            keeper.cancel(1)
        self.assertEqual(keeper.book("intro", at(MON, 9), "kim", 0), 2)


class RescheduleTests(unittest.TestCase):
    def test_reschedule_moves_the_booking(self):
        keeper = make(MORNING, INTRO)
        keeper.book("intro", at(MON, 9), "sam@example.com", 0)
        keeper.reschedule(1, at(MON, 10, 30), 0)
        self.assertEqual(keeper.get_booking(1), {
            "id": 1,
            "type_id": "intro",
            "host_id": "ana",
            "start": at(MON, 10, 30),
            "end": at(MON, 11),
            "invitee": "sam@example.com",
        })
        self.assertEqual(keeper.book("intro", at(MON, 9), "kim", 0), 2)

    def test_reschedule_ignores_the_booking_being_moved(self):
        keeper = make(MORNING, ("padded", 30, {"buffer_after": 15}))
        keeper.book("padded", at(MON, 9), "sam", 0)
        keeper.reschedule(1, at(MON, 9, 15), 0)
        booking = keeper.get_booking(1)
        self.assertEqual((booking["start"], booking["end"]), (at(MON, 9, 15), at(MON, 9, 45)))

    def test_failed_reschedule_keeps_the_original(self):
        keeper = make(MORNING, INTRO)
        keeper.book("intro", at(MON, 9), "sam", 0)
        keeper.book("intro", at(MON, 10), "kim", 0)
        original = keeper.get_booking(1)
        for start, error in [(at(MON, 10, 15), ConflictError), (at(TUE, 9), SlotUnavailableError), (at(MON, 9, 10), ValidationError)]:
            with self.subTest(error=error.__name__):
                with self.assertRaises(error):
                    keeper.reschedule(1, start, 0)
                self.assertEqual(keeper.get_booking(1), original)
        with self.assertRaises(ConflictError, msg="the original time is still held"):
            keeper.book("intro", at(MON, 9), "lee", 0)

    def test_reschedule_uses_now_and_rejects_unknown_ids(self):
        keeper = make(MORNING, ("advance", 30, {"min_notice": 60}))
        keeper.book("advance", at(MON, 11), "sam", 0)
        with self.assertRaises(TooSoonError):
            keeper.reschedule(1, at(MON, 9, 30), at(MON, 9))
        self.assertEqual(keeper.get_booking(1)["start"], at(MON, 11))
        keeper.reschedule(1, at(MON, 10), at(MON, 9))
        self.assertEqual(keeper.get_booking(1)["start"], at(MON, 10))
        with self.assertRaises(NotFoundError):
            keeper.reschedule(99, at(MON, 9, 10), 0)
        keeper.cancel(1)
        with self.assertRaises(NotFoundError):
            keeper.reschedule(1, at(MON, 11), 0)


class DailyLimitTests(unittest.TestCase):
    def test_daily_limit_counts_all_meeting_types_per_host(self):
        keeper = make([(0, 540, 720), (1, 540, 720)], INTRO, ("deep", 60, {}))
        keeper.add_host("bo", [(0, 540, 720)])
        keeper.add_meeting_type("bo", "bo-intro", 30)
        keeper.set_daily_limit("ana", 2)
        keeper.book("intro", at(MON, 9), "sam", 0)
        keeper.book("deep", at(MON, 10), "kim", 0)
        with self.assertRaises(DailyLimitError):
            keeper.book("intro", at(MON, 11), "lee", 0)
        self.assertEqual(keeper.list_slots("intro", MON, TUE, 0), every_15(at(TUE, 9), 11))
        self.assertEqual(keeper.book("intro", at(TUE, 9), "lee", 0), 3)
        self.assertEqual(keeper.book("bo-intro", at(MON, 11), "lee", 0), 4)

    def test_daily_limit_with_cancel_and_reschedule(self):
        keeper = make([(0, 540, 720), (1, 540, 720)], INTRO)
        keeper.set_daily_limit("ana", 1)
        keeper.book("intro", at(MON, 9), "sam", 0)
        keeper.reschedule(1, at(MON, 10), 0)          # the moved booking doesn't count against its own day
        keeper.book("intro", at(TUE, 9), "kim", 0)
        with self.assertRaises(DailyLimitError):
            keeper.reschedule(2, at(MON, 11), 0)
        self.assertEqual(keeper.get_booking(2)["start"], at(TUE, 9))
        keeper.cancel(1)
        keeper.reschedule(2, at(MON, 11), 0)
        self.assertEqual(keeper.get_booking(2)["start"], at(MON, 11))

    def test_daily_limit_settings(self):
        keeper = make(MORNING, INTRO)
        with self.assertRaises(NotFoundError):
            keeper.set_daily_limit("ghost", 2)
        with self.assertRaises(ValidationError):
            keeper.set_daily_limit("ana", 0)
        keeper.book("intro", at(MON, 9), "sam", 0)
        keeper.book("intro", at(MON, 10), "kim", 0)
        keeper.set_daily_limit("ana", 1)
        self.assertEqual(len(keeper.list_bookings("ana")), 2, "lowering the cap cancels nothing")
        with self.assertRaises(DailyLimitError):
            keeper.book("intro", at(MON, 11), "lee", 0)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), [])
        keeper.set_daily_limit("ana", None)
        self.assertEqual(keeper.book("intro", at(MON, 11), "lee", 0), 3)

    def test_conflict_is_reported_before_the_daily_limit(self):
        keeper = make(MORNING, INTRO)
        keeper.set_daily_limit("ana", 1)
        keeper.book("intro", at(MON, 9), "sam", 0)
        with self.assertRaises(ConflictError):
            keeper.book("intro", at(MON, 9, 15), "kim", 0)
        with self.assertRaises(DailyLimitError):
            keeper.book("intro", at(MON, 10), "kim", 0)


# ---------------------------------------------------------------------------
# Part 3 · Stretch
# ---------------------------------------------------------------------------

class OverrideTests(unittest.TestCase):
    def test_day_off_override(self):
        keeper = make([(0, 540, 600)], INTRO)
        keeper.set_override("ana", MON, [])
        self.assertEqual(
            keeper.list_slots("intro", 0, NEXT_MON, 0),
            every_15(at(0, 9), 3) + every_15(at(NEXT_MON, 9), 3),
        )
        with self.assertRaises(SlotUnavailableError):
            keeper.book("intro", at(MON, 9), "sam", 0)

    def test_override_adds_hours_on_a_free_day(self):
        keeper = make([(0, 540, 600)], INTRO)
        keeper.set_override("ana", SAT, [(600, 660)])
        self.assertEqual(keeper.list_slots("intro", SAT, SUN, 0), every_15(at(SAT, 10), 3))
        self.assertEqual(keeper.list_slots("intro", NEXT_SAT, NEXT_SAT, 0), [])
        self.assertEqual(keeper.book("intro", at(SAT, 10, 30), "sam", 0), 1)

    def test_override_replaces_the_weekly_pattern(self):
        keeper = make(MORNING, INTRO)
        keeper.set_override("ana", MON, [(840, 900)])
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), every_15(at(MON, 14), 3))
        keeper.set_override("ana", MON, [(540, 570), (570, 600)])
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), every_15(at(MON, 9), 3))
        keeper.clear_override("ana", MON)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), every_15(at(MON, 9), 11))
        keeper.clear_override("ana", MON)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), every_15(at(MON, 9), 11))

    def test_override_errors_and_existing_bookings(self):
        keeper = make(MORNING, INTRO)
        keeper.book("intro", at(MON, 9), "sam", 0)
        with self.assertRaises(NotFoundError):
            keeper.set_override("ghost", MON, [])
        with self.assertRaises(NotFoundError):
            keeper.clear_override("ghost", MON)
        with self.assertRaises(ValidationError):
            keeper.set_override("ana", MON, [(600, 540)])
        with self.assertRaises(ValidationError):
            keeper.set_override("ana", MON, [(540, 600), (0, 1441)])
        self.assertEqual(len(keeper.list_slots("intro", MON, MON, 0)), 9, "failed overrides change nothing")
        keeper.set_override("ana", MON, [])
        self.assertEqual([b["id"] for b in keeper.list_bookings("ana")], [1])
        self.assertEqual(keeper.get_booking(1)["start"], at(MON, 9))
        keeper.clear_override("ana", MON)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0)[0], at(MON, 9, 30))


class BusiestDayTests(unittest.TestCase):
    def test_busiest_days_sorted_and_limited(self):
        keeper = make([(0, 540, 720), (1, 540, 720), (2, 540, 720)], INTRO)
        for day, hours in [(TUE, (9, 10, 11)), (MON, (9,)), (WED, (9, 10, 11))]:
            for hour in hours:
                keeper.book("intro", at(day, hour), "x", 0)
        self.assertEqual(keeper.busiest_days("ana", 2), [(TUE, 3), (WED, 3)])
        self.assertEqual(keeper.busiest_days("ana", 10), [(TUE, 3), (WED, 3), (MON, 1)])

    def test_busiest_days_follow_changes_and_validate(self):
        keeper = make([(0, 540, 720), (1, 540, 720), (2, 540, 720)], INTRO)
        keeper.add_host("bo", [(0, 540, 720)])
        keeper.add_meeting_type("bo", "bo-intro", 30)
        self.assertEqual(keeper.busiest_days("ana", 3), [])
        keeper.book("intro", at(MON, 9), "a", 0)
        keeper.book("intro", at(MON, 10), "b", 0)
        keeper.book("intro", at(TUE, 9), "c", 0)
        keeper.book("bo-intro", at(MON, 11), "d", 0)
        keeper.cancel(1)
        keeper.reschedule(3, at(WED, 9), 0)
        self.assertEqual(keeper.busiest_days("ana", 5), [(MON, 1), (WED, 1)])
        with self.assertRaises(ValidationError):
            keeper.busiest_days("ana", 0)
        with self.assertRaises(NotFoundError):
            keeper.busiest_days("ghost", 1)


if __name__ == "__main__":
    unittest.main()
