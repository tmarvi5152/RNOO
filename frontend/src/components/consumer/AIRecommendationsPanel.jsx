import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Zap } from "lucide-react";
import apiService from "../services/apiService";

const AIRecommendationsPanel = ({ merchantId, customerEmail }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [trendingItems, setTrendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personalized");

  useEffect(() => {
    loadRecommendations();
  }, [merchantId, customerEmail]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const response = await apiService.get(
        `/api/recommendations/${merchantId}?customer_email=${customerEmail || ""}&limit=5`,
      );
      setRecommendations(response.data || []);

      const trendingResponse = await apiService.get(
        `/api/trending/${merchantId}?limit=5`,
      );
      setTrendingItems(trendingResponse.data || []);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  const RecommendationCard = ({ item, score, isAI = true }) => (
    <motion.div
      whileHover={{ y: -4 }}
      className="p-4 bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
    >
      {isAI && (
        <div className="flex items-center gap-1 mb-2">
          <Sparkles size={14} className="text-purple-500" />
          <span className="text-xs text-purple-600 font-medium">
            AI Recommended
          </span>
        </div>
      )}

      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-24 object-cover rounded mb-3"
        />
      )}

      <h4 className="font-semibold text-sm text-gray-900 mb-1">{item.name}</h4>
      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
        {item.description}
      </p>

      <div className="flex justify-between items-center">
        <span className="text-lg font-bold text-purple-600">${item.price}</span>
        {score && (
          <div className="flex items-center gap-1">
            <Zap size={12} className="text-yellow-500" />
            <span className="text-xs text-yellow-600">
              {Math.round(score)}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="w-full bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={24} className="text-white" />
          <h2 className="text-xl font-bold text-white">
            Smart Recommendations
          </h2>
        </div>
        <button
          onClick={loadRecommendations}
          disabled={loading}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setActiveTab("personalized")}
          className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
            activeTab === "personalized"
              ? "border-b-2 border-purple-600 text-purple-600 bg-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Sparkles size={16} />
            Personalized
          </div>
        </button>
        <button
          onClick={() => setActiveTab("trending")}
          className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
            activeTab === "trending"
              ? "border-b-2 border-purple-600 text-purple-600 bg-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <TrendingUp size={16} />
            Trending
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {activeTab === "personalized" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.length > 0 ? (
                  recommendations.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <RecommendationCard
                        item={item}
                        score={item.recommendation_score}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-gray-500">
                    <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Start ordering to get personalized recommendations!</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "trending" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendingItems.length > 0 ? (
                  trendingItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="relative">
                        <RecommendationCard
                          item={item}
                          score={item.growth_rate}
                          isAI={true}
                        />
                        <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                          +{Math.round(item.growth_rate)}%
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-gray-500">
                    <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No trending items yet!</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AIRecommendationsPanel;
