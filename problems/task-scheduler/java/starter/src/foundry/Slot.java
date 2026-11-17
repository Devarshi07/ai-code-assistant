package foundry;

/**
 * One task's place in a schedule.
 *
 * @param task   task name
 * @param worker runner index from 0
 * @param start  minute it starts
 * @param end    minute it finishes (start + duration)
 */
public record Slot(String task, int worker, int start, int end) {}
