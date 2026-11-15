import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'topTracks' function below.
     *
     * The function is expected to return a 2D_INTEGER_ARRAY.
     * The function accepts 2D_INTEGER_ARRAY events as parameter.
     */

    public static List<List<Integer>> topTracks(List<List<Integer>> events) {
        // Entries are {plays, track}, best first. Each play adds a fresh entry, and
        // entries whose play count is out of date are discarded when they surface.
        Map<Integer, Integer> plays = new HashMap<>();
        PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> a[0] != b[0] ? Integer.compare(b[0], a[0]) : Integer.compare(a[1], b[1]));
        List<List<Integer>> answers = new ArrayList<>();
        for (List<Integer> event : events) {
            int type = event.get(0);
            int value = event.get(1);
            if (type == 1) {
                int count = plays.merge(value, 1, Integer::sum);
                heap.add(new int[]{count, value});
            } else {
                List<int[]> top = new ArrayList<>();
                while (!heap.isEmpty() && top.size() < value) {
                    int[] entry = heap.poll();
                    if (plays.get(entry[1]) == entry[0]) top.add(entry);
                }
                List<Integer> ids = new ArrayList<>();
                for (int[] entry : top) {
                    heap.add(entry);
                    ids.add(entry[1]);
                }
                answers.add(ids);
            }
        }
        return answers;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
        BufferedWriter bufferedWriter = new BufferedWriter(new OutputStreamWriter(System.out));

        int q = Integer.parseInt(bufferedReader.readLine().trim());

        List<List<Integer>> events = new ArrayList<>();

        for (int i = 0; i < q; i++) {
            String[] eventsRowTempItems = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

            List<Integer> eventsRowItems = new ArrayList<>();

            for (int j = 0; j < 2; j++) {
                int eventsItem = Integer.parseInt(eventsRowTempItems[j]);
                eventsRowItems.add(eventsItem);
            }

            events.add(eventsRowItems);
        }

        List<List<Integer>> result = Result.topTracks(events);

        for (int i = 0; i < result.size(); i++) {
            for (int j = 0; j < result.get(i).size(); j++) {
                bufferedWriter.write(String.valueOf(result.get(i).get(j)));

                if (j != result.get(i).size() - 1) {
                    bufferedWriter.write(" ");
                }
            }

            bufferedWriter.newLine();
        }

        bufferedReader.close();
        bufferedWriter.close();
    }
}
