import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'courseOrder' function below.
     *
     * The function is expected to return a STRING.
     * The function accepts following parameters:
     *  1. INTEGER n
     *  2. 2D_INTEGER_ARRAY prerequisites
     */

    public static String courseOrder(int n, List<List<Integer>> prerequisites) {
        // Kahn's algorithm with a min-heap: always take the smallest course whose
        // prerequisites are all finished.
        List<List<Integer>> after = new ArrayList<>();
        for (int course = 0; course <= n; course++) after.add(new ArrayList<>());
        int[] waiting = new int[n + 1];
        for (List<Integer> prereq : prerequisites) {
            after.get(prereq.get(0)).add(prereq.get(1));
            waiting[prereq.get(1)]++;
        }
        PriorityQueue<Integer> ready = new PriorityQueue<>();
        for (int course = 1; course <= n; course++) {
            if (waiting[course] == 0) ready.add(course);
        }
        StringBuilder order = new StringBuilder();
        int taken = 0;
        while (!ready.isEmpty()) {
            int course = ready.poll();
            if (taken++ > 0) order.append(' ');
            order.append(course);
            for (int next : after.get(course)) {
                if (--waiting[next] == 0) ready.add(next);
            }
        }
        return taken == n ? order.toString() : "IMPOSSIBLE";
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int m = Integer.parseInt(firstMultipleInput[1]);

        List<List<Integer>> prerequisites = new ArrayList<>();

        for (int i = 0; i < m; i++) {
            String[] prerequisitesRowTempItems = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

            List<Integer> prerequisitesRowItems = new ArrayList<>();

            for (int j = 0; j < 2; j++) {
                int prerequisitesItem = Integer.parseInt(prerequisitesRowTempItems[j]);
                prerequisitesRowItems.add(prerequisitesItem);
            }

            prerequisites.add(prerequisitesRowItems);
        }

        String result = Result.courseOrder(n, prerequisites);

        System.out.println(result);

        bufferedReader.close();
    }
}
