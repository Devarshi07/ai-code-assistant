import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'cheapestTrip' function below.
     *
     * The function is expected to return a LONG_INTEGER.
     * The function accepts following parameters:
     *  1. INTEGER n
     *  2. 2D_INTEGER_ARRAY roads
     */

    public static long cheapestTrip(int n, List<List<Integer>> roads) {
        // Adjacency lists in compressed form, with both directions of every road.
        int m = roads.size();
        int[] start = new int[n + 2];
        for (List<Integer> r : roads) {
            start[r.get(0) + 1]++;
            start[r.get(1) + 1]++;
        }
        for (int i = 1; i <= n + 1; i++) start[i] += start[i - 1];
        int[] fill = Arrays.copyOf(start, n + 2);
        int[] to = new int[2 * m], cost = new int[2 * m];
        for (List<Integer> r : roads) {
            int u = r.get(0), v = r.get(1), c = r.get(2);
            to[fill[u]] = v;
            cost[fill[u]++] = c;
            to[fill[v]] = u;
            cost[fill[v]++] = c;
        }

        // Dijkstra over states (town, pass used?), encoded as 2 * town + used.
        long[] dist = new long[2 * n + 2];
        Arrays.fill(dist, Long.MAX_VALUE);
        dist[2] = 0;
        PriorityQueue<long[]> heap = new PriorityQueue<>((x, y) -> Long.compare(x[0], y[0]));
        heap.add(new long[]{0, 2});
        while (!heap.isEmpty()) {
            long[] top = heap.poll();
            long d = top[0];
            int state = (int) top[1];
            if (d > dist[state]) continue;
            int town = state >> 1, used = state & 1;
            // The first state of town n to leave the heap is the cheapest one.
            if (town == n) return d;
            for (int e = start[town]; e < start[town + 1]; e++) {
                int target = 2 * to[e] + used;
                if (d + cost[e] < dist[target]) {
                    dist[target] = d + cost[e];
                    heap.add(new long[]{dist[target], target});
                }
                if (used == 0) {
                    target = 2 * to[e] + 1;
                    if (d + cost[e] / 2 < dist[target]) {
                        dist[target] = d + cost[e] / 2;
                        heap.add(new long[]{dist[target], target});
                    }
                }
            }
        }
        return -1;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int m = Integer.parseInt(firstMultipleInput[1]);

        List<List<Integer>> roads = new ArrayList<>();

        IntStream.range(0, m).forEach(i -> {
            try {
                roads.add(
                    Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
                        .map(Integer::parseInt)
                        .collect(toList())
                );
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        });

        long result = Result.cheapestTrip(n, roads);

        System.out.println(result);

        bufferedReader.close();
    }
}
