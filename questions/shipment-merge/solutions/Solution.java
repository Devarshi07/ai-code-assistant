import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'mergeShipments' function below.
     *
     * The function is expected to return a 2D_INTEGER_ARRAY.
     * The function accepts 2D_INTEGER_ARRAY windows as parameter.
     */

    public static List<List<Integer>> mergeShipments(List<List<Integer>> windows) {
        // Sort by start, then keep extending the last busy period while the next
        // window starts at or before its end.
        List<List<Integer>> sorted = new ArrayList<>(windows);
        sorted.sort(Comparator.comparingInt(w -> w.get(0)));
        List<List<Integer>> merged = new ArrayList<>();
        int start = sorted.get(0).get(0);
        int end = sorted.get(0).get(1);
        for (List<Integer> w : sorted) {
            if (w.get(0) <= end) {
                end = Math.max(end, w.get(1));
            } else {
                merged.add(Arrays.asList(start, end));
                start = w.get(0);
                end = w.get(1);
            }
        }
        merged.add(Arrays.asList(start, end));
        return merged;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
        BufferedWriter bufferedWriter = new BufferedWriter(new OutputStreamWriter(System.out));

        int n = Integer.parseInt(bufferedReader.readLine().trim());

        List<List<Integer>> windows = new ArrayList<>();

        for (int i = 0; i < n; i++) {
            String[] windowsRowTempItems = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

            List<Integer> windowsRowItems = new ArrayList<>();

            for (int j = 0; j < 2; j++) {
                int windowsItem = Integer.parseInt(windowsRowTempItems[j]);
                windowsRowItems.add(windowsItem);
            }

            windows.add(windowsRowItems);
        }

        List<List<Integer>> result = Result.mergeShipments(windows);

        bufferedWriter.write(String.valueOf(result.size()));
        bufferedWriter.newLine();

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
