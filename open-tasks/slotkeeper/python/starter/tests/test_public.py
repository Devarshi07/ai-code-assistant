"""Provided tests: the basic happy path. The hidden acceptance tests go further."""

import unittest

from slotkeeper import SlotKeeper

MON = 7    # Monday of week 1
NEXT_MON = 14


def at(day, hour, minute=0):
    return day * 1440 + hour * 60 + minute


def make_keeper(windows=((0, 540, 600),)):
    """Host "ana", free on Mondays 09:00-10:00 by default, with a 30-minute "intro" type."""
    keeper = SlotKeeper()
    keeper.add_host("ana", list(windows))
    keeper.add_meeting_type("ana", "intro", 30)
    return keeper


class PublicTests(unittest.TestCase):
    def test_lists_slots_on_the_fifteen_minute_grid(self):
        keeper = make_keeper()
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)])

    def test_weekly_pattern_repeats_every_week(self):
        keeper = make_keeper()
        slots = keeper.list_slots("intro", MON, NEXT_MON, 0)
        self.assertEqual(slots, [
            at(MON, 9), at(MON, 9, 15), at(MON, 9, 30),
            at(NEXT_MON, 9), at(NEXT_MON, 9, 15), at(NEXT_MON, 9, 30),
        ])

    def test_book_returns_an_id_and_records_the_booking(self):
        keeper = make_keeper()
        booking_id = keeper.book("intro", at(MON, 9, 30), "sam@example.com", 0)
        self.assertEqual(booking_id, 1)
        self.assertEqual(keeper.get_booking(1), {
            "id": 1,
            "type_id": "intro",
            "host_id": "ana",
            "start": at(MON, 9, 30),
            "end": at(MON, 10),
            "invitee": "sam@example.com",
        })

    def test_booked_time_disappears_from_the_slot_list(self):
        keeper = make_keeper([(0, 540, 660)])
        keeper.book("intro", at(MON, 9, 30), "sam@example.com", 0)
        self.assertEqual(keeper.list_slots("intro", MON, MON, 0), [at(MON, 9), at(MON, 10), at(MON, 10, 15), at(MON, 10, 30)])

    def test_list_bookings_is_sorted_by_start(self):
        keeper = make_keeper([(0, 540, 660)])
        first = keeper.book("intro", at(MON, 10), "sam@example.com", 0)
        second = keeper.book("intro", at(MON, 9), "kim@example.com", 0)
        self.assertEqual((first, second), (1, 2))
        self.assertEqual([b["id"] for b in keeper.list_bookings("ana")], [2, 1])
        self.assertEqual([b["invitee"] for b in keeper.list_bookings("ana")], ["kim@example.com", "sam@example.com"])

    def test_hosts_have_independent_calendars(self):
        keeper = make_keeper()
        keeper.add_host("bo", [(0, 540, 600)])
        keeper.add_meeting_type("bo", "bo-intro", 30)
        keeper.book("intro", at(MON, 9), "sam@example.com", 0)
        self.assertEqual(keeper.list_slots("bo-intro", MON, MON, 0), [at(MON, 9), at(MON, 9, 15), at(MON, 9, 30)])
        self.assertEqual(keeper.list_bookings("bo"), [])


if __name__ == "__main__":
    unittest.main()
