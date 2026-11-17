package foundry;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A validated, acyclic set of tasks.
 *
 * <pre>
 * graph.get("compile")         the Task named compile
 * graph.dependents("compile")  names of the tasks that list compile in `after`
 * </pre>
 *
 * Iterating a graph yields its tasks in definition order.
 */
public final class DependencyGraph implements Iterable<Task> {
    /** The longest chain of tasks and how long it takes. */
    public record CriticalPath(int minutes, List<String> path) {}

    private final Map<String, Task> tasks = new LinkedHashMap<>();
    private final Map<String, List<String>> dependents = new HashMap<>();

    public DependencyGraph(List<Task> definitions) {
        for (Task task : definitions) {
            if (tasks.containsKey(task.name())) throw new PipelineError("task '" + task.name() + "' is defined twice");
            tasks.put(task.name(), task);
        }
        for (String name : tasks.keySet()) dependents.put(name, new ArrayList<>());
        for (Task task : tasks.values()) {
            for (String dep : task.deps()) {
                if (dep.equals(task.name())) throw new PipelineError("task '" + task.name() + "' depends on itself");
                if (!tasks.containsKey(dep)) {
                    throw new PipelineError("task '" + task.name() + "' depends on unknown task '" + dep + "'");
                }
                dependents.get(dep).add(task.name());
            }
        }
        Map<String, List<String>> deps = new LinkedHashMap<>();
        for (Task task : tasks.values()) deps.put(task.name(), task.deps());
        List<String> cycle = findCycle(deps);
        if (cycle != null) throw new CycleError(cycle);
    }

    /** Parse pipeline text and validate it into a DependencyGraph. */
    public static DependencyGraph load(String text) {
        return new DependencyGraph(Parser.parsePipeline(text));
    }

    public int size() {
        return tasks.size();
    }

    @Override
    public Iterator<Task> iterator() {
        return Collections.unmodifiableCollection(tasks.values()).iterator();
    }

    public boolean has(String name) {
        return tasks.containsKey(name);
    }

    public Task get(String name) {
        return tasks.get(name);
    }

    /** Task names in definition order. */
    public List<String> names() {
        return new ArrayList<>(tasks.keySet());
    }

    public List<String> dependents(String name) {
        return Collections.unmodifiableList(dependents.get(name));
    }

    /**
     * Task names, each after all of its dependencies. Kahn's algorithm with a
     * FIFO queue seeded in definition order, so the result is deterministic.
     */
    public List<String> topologicalOrder() {
        Map<String, Integer> waiting = new HashMap<>();
        List<String> queue = new ArrayList<>();
        for (Task task : tasks.values()) {
            waiting.put(task.name(), task.deps().size());
            if (task.deps().isEmpty()) queue.add(task.name());
        }
        for (int head = 0; head < queue.size(); head++) {
            for (String child : dependents.get(queue.get(head))) {
                int left = waiting.get(child) - 1;
                waiting.put(child, left);
                if (left == 0) queue.add(child);
            }
        }
        return queue;
    }

    /**
     * The longest chain of work: the minutes it takes and the task names from
     * first to last. No number of runners can finish the pipeline faster.
     */
    public CriticalPath criticalPath() {
        List<String> order = topologicalOrder();
        Map<String, Integer> finish = new HashMap<>();
        Map<String, String> via = new HashMap<>();
        for (String name : order) {
            int start = 0;
            String before = null;
            for (String dep : tasks.get(name).deps()) {
                if (finish.get(dep) > start) {
                    start = finish.get(dep);
                    before = dep;
                }
            }
            finish.put(name, start + tasks.get(name).duration());
            via.put(name, before);
        }
        String last = null;
        for (String name : order) {
            if (last == null || finish.get(name) > finish.get(last)) last = name;
        }
        List<String> path = new ArrayList<>();
        for (String name = last; name != null; name = via.get(name)) path.add(name);
        Collections.reverse(path);
        return new CriticalPath(path.isEmpty() ? 0 : finish.get(path.get(path.size() - 1)), path);
    }

    /**
     * Return one cycle in a map of name to dependencies as [a, b, ..., a], or
     * null. Iterative depth-first search, so very deep pipelines can't
     * overflow the stack. A dependency still on the current trail closes a loop.
     */
    static List<String> findCycle(Map<String, List<String>> deps) {
        Set<String> done = new HashSet<>();
        Set<String> onTrail = new HashSet<>();
        for (String root : deps.keySet()) {
            if (done.contains(root)) continue;
            List<String> trail = new ArrayList<>(List.of(root));
            List<Integer> next = new ArrayList<>(List.of(0));   // next.get(i): position of trail.get(i)'s next dependency
            onTrail.add(root);
            while (!trail.isEmpty()) {
                int top = trail.size() - 1;
                List<String> list = deps.get(trail.get(top));
                if (next.get(top) == list.size()) {
                    String finished = trail.remove(top);
                    next.remove(top);
                    onTrail.remove(finished);
                    done.add(finished);
                    continue;
                }
                String dep = list.get(next.get(top));
                next.set(top, next.get(top) + 1);
                if (onTrail.contains(dep)) {
                    List<String> cycle = new ArrayList<>(trail.subList(trail.indexOf(dep), trail.size()));
                    cycle.add(dep);
                    return cycle;
                }
                if (!done.contains(dep)) {
                    trail.add(dep);
                    next.add(0);
                    onTrail.add(dep);
                }
            }
        }
        return null;
    }
}
