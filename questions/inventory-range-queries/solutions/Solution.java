import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'processOperations' function below.
     *
     * The function is expected to return a LONG_INTEGER_ARRAY.
     * The function accepts following parameters:
     *  1. INTEGER_ARRAY stock
     *  2. 2D_INTEGER_ARRAY operations
     */

    public static List<Long> processOperations(List<Integer> stock, List<List<Integer>> operations) {
        // A Fenwick tree over the shelves, plus each shelf's current value so a
        // recount becomes an update by the difference.
        int n = stock.size();
        long[] current = new long[n + 1];
        long[] tree = new long[n + 1];
        for (int i = 1; i <= n; i++) {
            current[i] = stock.get(i - 1);
            tree[i] += current[i];
            int parent = i + (i & -i);
            if (parent <= n) tree[parent] += tree[i];
        }
        List<Long> answers = new ArrayList<>();
        for (List<Integer> op : operations) {
            int kind = op.get(0), x = op.get(1), y = op.get(2);
            if (kind == 1) {
                long delta = y - current[x];
                current[x] = y;
                for (int i = x; i <= n; i += i & -i) tree[i] += delta;
            } else {
                long total = 0;
                for (int i = y; i > 0; i &= i - 1) total += tree[i];
                for (int i = x - 1; i > 0; i &= i - 1) total -= tree[i];
                answers.add(total);
            }
        }
        return answers;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
        BufferedWriter bufferedWriter = new BufferedWriter(new OutputStreamWriter(System.out));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int q = Integer.parseInt(firstMultipleInput[1]);

        List<Integer> stock = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        List<List<Integer>> operations = new ArrayList<>();

        IntStream.range(0, q).forEach(i -> {
            try {
                operations.add(
                    Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
                        .map(Integer::parseInt)
                        .collect(toList())
                );
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        });

        List<Long> result = Result.processOperations(stock, operations);

        bufferedWriter.write(
            result.stream()
                .map(Object::toString)
                .collect(joining("\n"))
            + "\n"
        );

        bufferedReader.close();
        bufferedWriter.close();
    }
}
