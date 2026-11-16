package shipping;

/** One line of an order: a catalogue item and how many units of it. */
public record OrderLine(Item item, int quantity) {
    public int weightG() {
        return item.weightG() * quantity;
    }
}
