import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'rollingMedian' function below.
     *
     * The function is expected to return an INTEGER_ARRAY.
     * The function accepts following parameters:
     *  1. INTEGER_ARRAY latency
     *  2. INTEGER k
     */

    public static List<Integer> rollingMedian(List<Integer> latency, int k) {
        // lo (a max-heap) holds the smaller ceil(size / 2) values of the window and
        // hi the rest, so the lower median is the top of lo. A key packs
        // (value, index) into one long, unique per element; entries that left the
        // window are discarded lazily when they reach a heap's top.
        final int SHIFT = 17;
        final long MASK = (1L << SHIFT) - 1;
        int n = latency.size();
        long[] keys = new long[n];
        for (int i = 0; i < n; i++) keys[i] = ((long) latency.get(i).intValue() << SHIFT) | i;
        PriorityQueue<Long> lo = new PriorityQueue<>(Collections.reverseOrder());
        PriorityQueue<Long> hi = new PriorityQueue<>();
        int loSize = 0, hiSize = 0;
        List<Integer> medians = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            int start = i - k + 1;
            if (i >= k) {
                if (keys[i - k] <= lo.peek()) loSize--;
                else hiSize--;
            }
            while (!lo.isEmpty() && (lo.peek() & MASK) < start) lo.poll();
            if (!lo.isEmpty() && keys[i] < lo.peek()) { lo.add(keys[i]); loSize++; }
            else { hi.add(keys[i]); hiSize++; }
            if (loSize > hiSize + 1) {
                while ((lo.peek() & MASK) < start) lo.poll();
                hi.add(lo.poll());
                loSize--; hiSize++;
            } else if (loSize < hiSize) {
                while ((hi.peek() & MASK) < start) hi.poll();
                lo.add(hi.poll());
                loSize++; hiSize--;
            }
            if (start >= 0) {
                while ((lo.peek() & MASK) < start) lo.poll();
                medians.add((int) (lo.peek() >> SHIFT));
            }
        }
        return medians;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
        BufferedWriter bufferedWriter = new BufferedWriter(new OutputStreamWriter(System.out));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int k = Integer.parseInt(firstMultipleInput[1]);

        List<Integer> latency = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        List<Integer> result = Result.rollingMedian(latency, k);

        bufferedWriter.write(
            result.stream()
                .map(Object::toString)
                .collect(joining(" "))
            + "\n"
        );

        bufferedReader.close();
        bufferedWriter.close();
    }
}
