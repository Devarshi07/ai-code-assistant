import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'minMeetingRooms' function below.
     *
     * The function is expected to return an INTEGER.
     * The function accepts 2D_INTEGER_ARRAY meetings as parameter.
     */

    public static int minMeetingRooms(List<List<Integer>> meetings) {
        int n = meetings.size();
        int[][] byStart = new int[n][];
        for (int i = 0; i < n; i++) {
            byStart[i] = new int[] {meetings.get(i).get(0), meetings.get(i).get(1)};
        }
        Arrays.sort(byStart, (x, y) -> Integer.compare(x[0], y[0]));
        PriorityQueue<Integer> ends = new PriorityQueue<>();  // end times of the rooms in use
        for (int[] meeting : byStart) {
            if (!ends.isEmpty() && ends.peek() <= meeting[0]) ends.poll();  // take over the room that frees up first
            ends.add(meeting[1]);
        }
        return ends.size();
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        int n = Integer.parseInt(bufferedReader.readLine().trim());

        List<List<Integer>> meetings = new ArrayList<>();

        IntStream.range(0, n).forEach(i -> {
            try {
                meetings.add(
                    Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
                        .map(Integer::parseInt)
                        .collect(toList())
                );
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        });

        int result = Result.minMeetingRooms(meetings);

        System.out.println(result);

        bufferedReader.close();
    }
}
