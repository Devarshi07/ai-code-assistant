package transit;

/** Sample timetables from the scheduling team. */
public final class Samples {
    public static final String HARBOUR_CITY = """
            # Harbour City Transit: weekday service
            # line <name> [oneway]: <station> <minutes> <station> <minutes> <station> ...

            line Red: Airport 4 Central 3 Harbor 6 Museum
            line Blue: Museum 2 Old Town 5 Central 7 University
            line Green: University 3 Science Park 4 Riverside 6 Harbor
            line Express: Airport 9 University
            line Circle: Central 2 Market Square 2 City Hall 3 Old Town 2 Central

            # The harbour ferry sails a one-way loop.
            line Ferry oneway: Harbor 8 Island Pier 5 Lighthouse 10 Harbor
            """;

    private Samples() {
    }

    public static Network loadHarbourCity() {
        return Timetable.loadNetwork(HARBOUR_CITY, "Harbour City");
    }
}
