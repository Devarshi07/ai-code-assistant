import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'topWords' function below.
     *
     * The function is expected to return a STRING_ARRAY.
     * The function accepts following parameters:
     *  1. STRING_ARRAY lines
     *  2. INTEGER k
     */

    public static List<String> topWords(List<String> lines, int k) {
        Map<String, Integer> counts = new HashMap<>();
        for (String line : lines) {
            for (String word : line.split(" ")) {
                if (!word.isEmpty()) counts.merge(word, 1, Integer::sum);
            }
        }
        List<Map.Entry<String, Integer>> ranked = new ArrayList<>(counts.entrySet());
        ranked.sort((a, b) -> !a.getValue().equals(b.getValue()) ? b.getValue() - a.getValue() : a.getKey().compareTo(b.getKey()));
        List<String> result = new ArrayList<>();
        for (int i = 0; i < Math.min(k, ranked.size()); i++) {
            result.add(ranked.get(i).getKey() + " " + ranked.get(i).getValue());
        }
        return result;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int m = Integer.parseInt(firstMultipleInput[0]);

        int k = Integer.parseInt(firstMultipleInput[1]);

        List<String> lines = new ArrayList<>();

        for (int i = 0; i < m; i++) {
            String linesItem = bufferedReader.readLine().replaceAll("\\s+$", "");
            lines.add(linesItem);
        }

        List<String> result = Result.topWords(lines, k);

        System.out.println(String.join("\n", result));

        bufferedReader.close();
    }
}
