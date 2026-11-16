# Machine learning engineer interviews

ML engineer loops usually mix five kinds of rounds: **ML coding** (implement something from scratch, checked by tests), **ML fundamentals** (a screen or multiple choice), **ML system design**, a **project deep dive**, and often a standard coding round. Newer loops add **LLM and RAG design** questions, and some run the screen with an AI interviewer. This guide covers what each round looks for and how to prepare.

## ML coding

Typical tasks, described as patterns rather than specific questions:

- metrics from raw scores: precision, recall, F1, ROC-AUC with tied scores, a confusion matrix;
- k-means or k-nearest neighbours from scratch;
- linear or logistic regression trained with gradient descent;
- choosing the best split for a decision tree with Gini impurity or entropy;
- softmax and cross-entropy that don't overflow; attention with a causal mask;
- decoding: greedy, top-k and top-p sampling, a beam search step;
- a step of byte-pair encoding: count pairs, merge the most frequent;
- building a training set from event tables without leakage.

**How to approach them**

1. Clarify shapes and edge cases: empty input, a class with no examples, ties, division by zero, very large or small values.
2. Work one tiny example by hand before coding, and keep it as your first test.
3. Write the straightforward loop version first, then vectorize if there's time.
4. Use numerically stable formulas: subtract the maximum before exponentiating, compute log-softmax with log-sum-exp.
5. Test against hand-computed values and properties (probabilities sum to one, loss decreases on a toy problem).

## Fundamentals you should explain in two minutes each

- [ ] Bias and variance, and reading learning curves
- [ ] Regularization: L1 versus L2, dropout, early stopping, data augmentation
- [ ] Metrics for imbalanced data, choosing a threshold, calibration
- [ ] Validation: k-fold, time-based splits, the main kinds of data leakage
- [ ] Trees versus linear models versus neural networks, and when to scale features
- [ ] Gradient descent, backpropagation, vanishing and exploding gradients, normalization layers
- [ ] Transformers: attention, the causal mask, positional information, the KV cache
- [ ] LLM basics: tokens, context windows, temperature, hallucination, RAG versus fine-tuning

For each, prepare a short definition, an example, and one practical consequence ("so I'd use a time-based split for this forecasting problem").

## ML system design

A structure that keeps you from missing a whole area:

1. **Clarify the product goal**: users, scale, latency, what success means for the business.
2. **Frame it as an ML task**: the prediction target and its label, offline metrics, online metrics and guardrail metrics.
3. **Data**: sources, how labels are collected, label delay, freshness, privacy, and how you avoid leakage with point-in-time correct joins.
4. **Features**: the most predictive signals, which must be real-time, and where they're computed.
5. **Model**: a simple baseline first (a heuristic or logistic regression), then a stronger model with a reason.
6. **Evaluation**: offline evaluation with error analysis, then an online A/B test with guardrails.
7. **Serving**: batch or online, the latency budget, a feature store so training and serving agree, fallbacks when something fails.
8. **Monitoring and iteration**: input and prediction drift, data quality, delayed performance, retraining triggers.
9. **Risks**: feedback loops, fairness, abuse, cold start.

Common prompts include a ranking or recommendation feed, card fraud detection, search relevance, delivery-time estimates with real-time features, a support assistant built on retrieval, and content moderation. Strong answers use numbers (traffic, label delay, latency), name trade-offs, start from a baseline and say how the system could fail.

## LLM and RAG application design

- **Retrieval**: chunking by document structure with overlap, hybrid keyword plus vector search, reranking, metadata filters.
- **Generation**: prompts that require answering from the retrieved context with citations, and permission to say "I don't know".
- **Evaluation**: a labelled question set; retrieval recall@k, groundedness of answers, answer quality ratings, an LLM judge checked against people.
- **Guardrails**: treating retrieved text as untrusted (prompt injection), limiting tools and confirming risky actions, handling personal data.
- **Cost and latency**: caching, smaller models for easy requests, streaming.

A favourite debugging question: "the right document exists, but the answer is wrong." Check retrieval first (is the passage in the top k?), then chunk boundaries, then the prompt and the generation step, measuring each change on the same question set.

## Project deep dive

Prepare one or two projects so you can answer:

- [ ] What was the problem, and why did it matter? Who used the result?
- [ ] What exactly was your part?
- [ ] What data did you use: size, labels, quality problems?
- [ ] What was the baseline, and what did the final model add?
- [ ] Which metrics, with real numbers, offline and online?
- [ ] How was it deployed and monitored?
- [ ] What failed, and what would you do differently now?

Keep answers to about a minute and let the interviewer dig. Expect "why not X?" for every major decision; having considered alternatives is part of the answer. If an AI interviewer runs the round, it will usually state an agenda, ask one question at a time and adapt follow-ups, so give concrete examples and answer the follow-up before adding anything new.

## Practising in this app

- **Mock interviews:** ML system design, ML fundamentals screen and ML project deep dive, each scored on four areas.
- **Practice tests:** the ML engineer assessment (ML multiple choice, a written answer and ML-focused coding).
- **Coding questions:** filter by the Machine Learning skill.
- **Multiple choice:** the Machine Learning, Deep Learning, LLMs and RAG, and ML Systems topics in the custom test builder.
