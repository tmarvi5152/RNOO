import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import apiService from "../services/apiService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AIMerchantInsights = ({ merchantId }) => {
  const [insights, setInsights] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadInsights();
  }, [merchantId]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const insightsResponse = await apiService.get(
        `/api/ai/insights/${merchantId}/sales`,
      );
      setInsights(insightsResponse.data);

      const suggestionsResponse = await apiService.get(
        `/api/ai/insights/${merchantId}/menu-optimization`,
      );
      setSuggestions(suggestionsResponse.data);

      const peakHoursResponse = await apiService.get(
        `/api/ai/insights/${merchantId}/peak-hours`,
      );
      setPeakHours(peakHoursResponse.data);
    } catch (error) {
      console.error("Failed to load insights:", error);
    } finally {
      setLoading(false);
    }
  };

  const InsightCard = ({
    title,
    value,
    icon: Icon,
    trend,
    color = "purple",
  }) => (
    <motion.div
      whileHover={{ y: -4 }}
      className={`p-6 bg-gradient-to-br from-${color}-50 to-white border border-${color}-200 rounded-lg shadow-sm`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p
              className={`text-xs mt-2 ${trend > 0 ? "text-green-600" : "text-red-600"}`}
            >
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last period
            </p>
          )}
        </div>
        <div className={`p-3 bg-${color}-100 rounded-lg`}>
          <Icon size={24} className={`text-${color}-600`} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-lg">
              <BarChart3 size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Merchant Insights
              </h1>
              <p className="text-purple-100">
                AI-powered business analytics & recommendations
              </p>
            </div>
          </div>
          <button
            onClick={loadInsights}
            disabled={loading}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "suggestions", label: "Suggestions", icon: Lightbulb },
              { id: "peak-hours", label: "Peak Hours", icon: Clock },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-purple-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && insights && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <InsightCard
                  title="Total Orders"
                  value={insights.total_orders}
                  icon={BarChart3}
                  color="blue"
                />
                <InsightCard
                  title="Total Revenue"
                  value={`$${insights.total_revenue.toFixed(2)}`}
                  icon={TrendingUp}
                  color="green"
                />
                <InsightCard
                  title="Average Order Value"
                  value={`$${insights.average_order_value.toFixed(2)}`}
                  icon={BarChart3}
                  color="purple"
                />
                <InsightCard
                  title="Completion Rate"
                  value={`${Math.round(((insights.total_orders - insights.cancelled_orders) / insights.total_orders) * 100)}%`}
                  icon={TrendingUp}
                  color="green"
                />
              </div>

              {/* Insights List */}
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-3">
                <h3 className="font-semibold text-lg text-gray-900 mb-4">
                  Key Insights
                </h3>
                {insights.insights &&
                  insights.insights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200"
                    >
                      <Lightbulb
                        size={20}
                        className="text-purple-600 flex-shrink-0 mt-0.5"
                      />
                      <p className="text-gray-700">{insight}</p>
                    </motion.div>
                  ))}
              </div>

              {/* Day Breakdown */}
              {insights.day_breakdown && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-4">
                    Orders by Day of Week
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Object.entries(insights.day_breakdown).map(
                        ([day, value]) => ({
                          day,
                          orders: value,
                        }),
                      )}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#7C3AED" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Suggestions Tab */}
          {activeTab === "suggestions" && suggestions && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Sellers */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp size={20} className="text-green-600" />
                    Top Sellers
                  </h3>
                  <div className="space-y-2">
                    {suggestions.top_sellers &&
                      suggestions.top_sellers.map((item, index) => (
                        <div
                          key={index}
                          className="flex justify-between p-2 bg-green-50 rounded"
                        >
                          <span className="font-medium text-gray-900">
                            {item.name}
                          </span>
                          <span className="text-green-600 font-bold">
                            {item.orders} orders
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Low Performers */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-600" />
                    Low Performers
                  </h3>
                  <div className="space-y-2">
                    {suggestions.low_performers &&
                      suggestions.low_performers.map((item, index) => (
                        <div
                          key={index}
                          className="flex justify-between p-2 bg-red-50 rounded"
                        >
                          <span className="font-medium text-gray-900">
                            {item.name}
                          </span>
                          <span className="text-red-600 font-bold">
                            {item.orders} orders
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-sm p-6 border border-purple-200">
                <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
                  <Lightbulb size={20} className="text-purple-600" />
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {suggestions.suggestions &&
                    suggestions.suggestions.map((suggestion, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 bg-white rounded-lg border-l-4 border-purple-600"
                      >
                        <p className="text-gray-700">{suggestion}</p>
                      </motion.div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Peak Hours Tab */}
          {activeTab === "peak-hours" && peakHours && (
            <div className="space-y-6">
              {/* Peak Hours Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-4">
                  Orders by Hour
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={peakHours.peak_hours}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#7C3AED" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Peak Hours Insights */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-4">
                  Insights
                </h3>
                <div className="space-y-3">
                  {peakHours.insights &&
                    peakHours.insights.map((insight, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200"
                      >
                        <Clock
                          size={20}
                          className="text-orange-600 flex-shrink-0 mt-0.5"
                        />
                        <p className="text-gray-700">{insight}</p>
                      </motion.div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AIMerchantInsights;
